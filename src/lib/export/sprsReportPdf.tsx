/* ============================================================================
   SPRS readiness report .pdf renderer — turns the pure SprsReportModel
   (sprsReportModel.ts) into a @react-pdf/renderer document and, ultimately, a
   downloadable Blob. CLIENT-SIDE generation only: no server render, no Supabase
   storage — the report is the CLIENT'S document and is never persisted.

   Why @react-pdf and not pdfmake: pdfmake's pdfkit getBuffer/getBlob never
   completes in this app's browser environment (verified hanging in both the
   Vite dev server and a production preview build, headed and headless), so it
   cannot produce a file. @react-pdf renders reliably via toBlob().

   The by-family bar chart is drawn with @react-pdf's NATIVE Svg/Rect primitives
   (no html2canvas screenshots). The readiness-support disclaimer is repeated on
   EVERY page via a `fixed` footer. `SprsReportDocument` is the testable element
   tree; `generateSprsPdfBlob` packs the Blob (validated end-to-end in the e2e).
   ============================================================================ */
import type { ReactElement } from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Svg,
  Rect,
  pdf,
} from '@react-pdf/renderer';
import {
  buildSprsReportModel,
  type SprsReportInput,
  type SprsReportModel,
} from './sprsReportModel';
import {
  DOD_AM_CITATION,
  exportFilename,
  NAVY as NAVY_HEX,
  READINESS_SUPPORT_DISCLAIMER,
  SILVER as SILVER_HEX,
} from './common';
import { formatScore } from '../scoring';

/* ---- palette as CSS hex (@react-pdf wants '#RRGGBB') ---- */
const NAVY = `#${NAVY_HEX}`;
const SILVER = `#${SILVER_HEX}`;
const INK = '#1e1c18';
const TRACK = '#e9eaec';

const BAR_MAX_WIDTH = 230; // pts — the readiness=100% bar width

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingHorizontal: 44,
    paddingBottom: 64, // room for the fixed footer
    fontSize: 10,
    color: INK,
    fontFamily: 'Helvetica',
    lineHeight: 1.3,
  },
  coverClient: { fontSize: 16, color: NAVY, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginTop: 48 },
  coverTitle: { fontSize: 26, color: NAVY, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 22 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 8, color: SILVER, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  scoreBig: { fontSize: 40, color: NAVY, fontFamily: 'Helvetica-Bold' },
  scoreMid: { fontSize: 22, color: NAVY, fontFamily: 'Helvetica-Bold' },
  statSub: { fontSize: 8, color: SILVER, marginTop: 2 },
  caption: { fontSize: 9, color: SILVER, textAlign: 'center', marginBottom: 6 },
  h2: { fontSize: 14, color: NAVY, fontFamily: 'Helvetica-Bold', marginTop: 18, marginBottom: 6 },
  body: { fontSize: 10, color: INK, marginBottom: 3 },
  listItem: { flexDirection: 'row', marginBottom: 3 },
  listNum: { width: 16, color: SILVER },
  listText: { flex: 1 },
  disclaimer: { fontSize: 8, color: SILVER, fontFamily: 'Helvetica-Oblique', marginTop: 8 },
  famRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  famLabel: { width: 120 },
  famCode: { color: NAVY, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  famName: { color: SILVER, fontSize: 7 },
  famValue: { width: 36, textAlign: 'right', color: NAVY, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  footer: { position: 'absolute', bottom: 24, left: 44, right: 44 },
  footerDisclaimer: { fontSize: 7, color: SILVER, fontFamily: 'Helvetica-Oblique', textAlign: 'center' },
  footerLine: { fontSize: 7, color: SILVER, textAlign: 'center', marginTop: 2 },
});

/** Footer page line — exported so it can be unit-tested independently. */
export function footerPageLabel(model: SprsReportModel, pageNumber: number, totalPages: number): string {
  return `${model.meta.clientName}  ·  CONFIDENTIAL  ·  Page ${pageNumber} of ${totalPages}`;
}

/* Plain element-returning helpers (NOT components) so the returned tree holds
   concrete elements — the unit test can walk it without a React renderer. */

function orderedListItems(items: string[]): ReactElement[] {
  return items.map((t, i) => (
    <View key={i} style={styles.listItem}>
      <Text style={styles.listNum}>{`${i + 1}.`}</Text>
      <Text style={styles.listText}>{t}</Text>
    </View>
  ));
}

/** One family row: label · native Svg bar (track + fill) · value. */
function familyBar(bar: { code: string; name: string; readiness: number }): ReactElement {
  const fillW = (Math.max(0, Math.min(100, bar.readiness)) / 100) * BAR_MAX_WIDTH;
  return (
    <View key={bar.code} style={styles.famRow}>
      <View style={styles.famLabel}>
        <Text>
          <Text style={styles.famCode}>{bar.code}</Text>
          <Text style={styles.famName}>{` ${bar.name}`}</Text>
        </Text>
      </View>
      <Svg width={BAR_MAX_WIDTH} height={11}>
        <Rect x={0} y={1} width={BAR_MAX_WIDTH} height={9} rx={1} fill={TRACK} />
        <Rect x={0} y={1} width={fillW} height={9} rx={1} fill={NAVY} />
      </Svg>
      <Text style={styles.famValue}>{`${bar.readiness}%`}</Text>
    </View>
  );
}

/** The full SPRS report document — a @react-pdf element tree (testable). */
export function SprsReportDocument({ model }: { model: SprsReportModel }) {
  const methodologyBullets = [
    DOD_AM_CITATION,
    'Baseline 110; each requirement that is not implemented deducts its official -5 / -3 / -1 value.',
    'Partial is not an official SPRS status — it is counted conservatively as a full deduction (Not Met).',
    'Requirement 3.12.4 (System Security Plan) is scored "NA" in the methodology and never deducts.',
  ];
  const findings =
    model.findings.length > 0
      ? model.findings.map((f) => f.text)
      : ['No material findings — readiness review in good standing.'];
  const recovery =
    model.recovery.length > 0
      ? model.recovery.map(
          (r) => `${r.controlId} ${r.title} — recover +${r.impact} (currently ${r.status})`,
        )
      : ['No recoverable deductions — all scored controls are Met or Not Applicable.'];

  return (
    <Document
      title={`SPRS Readiness Report — ${model.meta.clientName}`}
      author="Benchmark Fox Readiness Portal"
      subject="CMMC readiness SPRS estimate (readiness support only — not a certification)."
    >
      <Page size="LETTER" style={styles.page} wrap>
        {/* Fixed footer — repeats on every page with the standing disclaimer. */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerDisclaimer}>{READINESS_SUPPORT_DISCLAIMER}</Text>
          <Text
            style={styles.footerLine}
            render={({ pageNumber, totalPages }) => footerPageLabel(model, pageNumber, totalPages)}
          />
        </View>

        {/* Cover */}
        <Text style={styles.coverClient}>{model.meta.clientName}</Text>
        <Text style={styles.coverTitle}>CMMC Readiness — SPRS Estimate</Text>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>ESTIMATED SPRS SCORE</Text>
            <Text style={styles.scoreBig}>{formatScore(model.sprs.estimatedSprsScore)}</Text>
            <Text style={styles.statSub}>of 110</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>READINESS</Text>
            <Text style={styles.scoreMid}>{`${model.readinessPct}%`}</Text>
            <Text style={styles.statSub}>{`Risk: ${model.riskBand}`}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>CMMC TARGET</Text>
            <Text style={styles.scoreMid}>{model.meta.cmmcTarget}</Text>
            <Text style={styles.statSub}>{`Prepared ${model.meta.generatedAtLabel}`}</Text>
          </View>
        </View>
        <Text style={styles.caption}>
          {`${model.statusCounts.met} Met · ${model.statusCounts.partial} Partial · ` +
            `${model.statusCounts.notMet} Not Met · ${model.statusCounts.notReviewed} Not Reviewed · ` +
            `${model.statusCounts.notApplicable} N/A`}
        </Text>
        <Text style={[styles.caption, { fontFamily: 'Helvetica-Oblique' }]}>
          Prepared with Benchmark Fox
        </Text>

        {/* Methodology */}
        <Text style={styles.h2}>Methodology</Text>
        {orderedListItems(methodologyBullets)}
        <Text style={styles.disclaimer}>{READINESS_SUPPORT_DISCLAIMER}</Text>

        {/* By-family readiness (native Svg bars) */}
        <Text style={styles.h2}>Readiness by Control Family</Text>
        {model.families.map(familyBar)}

        {/* Top findings */}
        <Text style={styles.h2}>Top Findings</Text>
        {orderedListItems(findings)}

        {/* Score-recovery opportunities */}
        <Text style={styles.h2}>Top Score-Recovery Opportunities</Text>
        <Text style={[styles.body, { color: SILVER }]}>
          Remediating these unmet controls would recover the most SPRS points.
        </Text>
        {orderedListItems(recovery)}
      </Page>
    </Document>
  );
}

/** Suggested download filename, e.g. "Acme_Defense_SPRS-Readiness_2026-06-13.pdf". */
export function sprsReportFilename(model: SprsReportModel): string {
  return exportFilename(model.meta.clientName, 'SPRS-Readiness', 'pdf', model.meta.generatedAt);
}

/** PURE entry point: SPRS data in → .pdf Blob out (rendered in the browser). */
export async function generateSprsPdfBlob(
  input: SprsReportInput,
): Promise<{ blob: Blob; filename: string }> {
  const model = buildSprsReportModel(input);
  const blob = await pdf(<SprsReportDocument model={model} />).toBlob();
  return { blob, filename: sprsReportFilename(model) };
}
