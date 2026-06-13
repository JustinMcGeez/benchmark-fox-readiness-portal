/* ============================================================================
   Report export UI — the "Generate POA&M (.xlsx)" and "Generate SPRS Report
   (.pdf)" triggers shown on the Reports screen, alongside the SSP button from
   Task 09. Each opens a pre-flight summary (the same pattern as SspExport) and,
   on an explicit Generate, builds the deliverable CLIENT-SIDE, downloads it, and
   writes a metadata-only audit event. No artifact is ever stored by this product.

   The pure model builders (renderer-free) drive the pre-flight; the heavy
   renderer (exceljs / @react-pdf) is lazy-imported only on generate, so the main
   bundle stays lean (each renderer is its own Vite chunk).
   ============================================================================ */
import { useMemo, useState, type ReactNode } from 'react';
import { saveAs } from 'file-saver';
import { Btn } from './primitives';
import { useData } from '../data/store';
import { useReference } from '../data/referenceStore';
import { useCurrentClient } from '../data/clientsStore';
import { POAM_ITEMS } from '../data/poam';
import { logEvent } from '../lib/audit';
import { formatScore } from '../lib/scoring';
import { buildPoamWorkbookModel, type PoamWorkbookInput } from '../lib/export/poamModel';
import { buildSprsReportModel, type SprsReportInput } from '../lib/export/sprsReportModel';

/** Shared client-scoped data for the POA&M + SPRS exporters. */
function useClientExportData() {
  const { assessments, evidence, currentClientId } = useData();
  const { controls, controlsById } = useReference();
  const client = useCurrentClient();
  const clientName = client?.name ?? 'Client';
  const cmmcTarget = client?.cmmcPath ?? 'Undetermined';
  const poam = useMemo(
    () => POAM_ITEMS.filter((p) => p.clientId === currentClientId),
    [currentClientId],
  );
  return {
    assessments,
    evidence,
    controls,
    controlsById,
    clientName,
    cmmcTarget,
    poam,
    clientId: currentClientId,
  };
}

/* ---- shared pre-flight modal shell (mirrors SspExport's dialog) ---- */

interface StatBox {
  label: string;
  value: ReactNode;
}

function ExportDialog({
  title,
  subtitle,
  stats,
  note,
  busy,
  error,
  generateLabel,
  onClose,
  onGenerate,
}: {
  title: string;
  subtitle: ReactNode;
  stats: StatBox[];
  note: ReactNode;
  busy: boolean;
  error: string | null;
  generateLabel: string;
  onClose: () => void;
  onGenerate: () => void;
}) {
  return (
    <div
      onClick={busy ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1001,
        background: 'rgba(30,28,24,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-card"
        style={{ width: 'min(540px, 96vw)', maxHeight: '88vh', overflow: 'auto', padding: 24 }}
      >
        <div className="between" style={{ marginBottom: 14 }}>
          <h2 className="w-h2">{title}</h2>
          <Btn onClick={onClose} disabled={busy}>
            ✕ Close
          </Btn>
        </div>

        <p className="muted" style={{ margin: '0 0 12px', fontSize: '.9em' }}>
          {subtitle}
        </p>

        <div className="grid-3" style={{ gap: 10 }}>
          {stats.map((s) => (
            <div key={s.label} className="w-box" style={{ padding: 12, textAlign: 'center' }}>
              <div className="mono faint" style={{ fontSize: '.62em' }}>
                {s.label}
              </div>
              <div className="w-h2">{s.value}</div>
            </div>
          ))}
        </div>

        <p className="annot" style={{ margin: '12px 0 0', fontSize: '.82em' }}>
          {note} The file is generated in your browser and downloaded; no file is stored.
        </p>

        {error && (
          <p className="annot" style={{ margin: '10px 0 0', color: 'var(--bad, #c0392b)' }}>
            {error}
          </p>
        )}

        <div className="row gap-sm mt" style={{ justifyContent: 'flex-end' }}>
          <Btn ghost onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn primary onClick={onGenerate} disabled={busy}>
            {busy ? 'Generating…' : generateLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ---- POA&M (.xlsx) ---- */

function PoamExportDialog({ onClose }: { onClose: () => void }) {
  const { assessments, controlsById, clientName, poam, clientId } = useClientExportData();
  const input = useMemo<PoamWorkbookInput>(
    () => ({ clientName, poam, assessments, controlsById }),
    [clientName, poam, assessments, controlsById],
  );
  const { counts } = useMemo(() => buildPoamWorkbookModel(input), [input]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const { generatePoamBlob } = await import('../lib/export/poamXlsx');
      const { blob, filename } = await generatePoamBlob(input);
      saveAs(blob, filename);
      void logEvent('report.poam_generated', { clientId });
      onClose();
    } catch {
      setError('Could not generate the POA&M workbook. Please try again.');
      setBusy(false);
    }
  };

  return (
    <ExportDialog
      title="Generate POA&M (.xlsx)"
      subtitle={`${clientName} · DoD/eMASS-style workbook`}
      stats={[
        { label: 'OPEN ITEMS', value: counts.open },
        { label: 'CLOSED ITEMS', value: counts.closed },
        { label: 'SHEETS', value: 3 },
      ]}
      note={
        counts.open === 0
          ? 'No open POA&M items — the workbook will still generate with an empty open sheet plus the Closed and Score Impact sheets.'
          : `${counts.open} open item(s) on the main sheet, closed items on a second sheet, and a Score Impact sheet projecting the SPRS gain per remediation.`
      }
      busy={busy}
      error={error}
      generateLabel="Generate workbook"
      onClose={onClose}
      onGenerate={generate}
    />
  );
}

export function GeneratePoamButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn primary onClick={() => setOpen(true)}>
        Generate POA&M (.xlsx)
      </Btn>
      {open && <PoamExportDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/* ---- SPRS readiness report (.pdf) ---- */

function SprsReportExportDialog({ onClose }: { onClose: () => void }) {
  const { assessments, controls, controlsById, evidence, poam, clientName, cmmcTarget, clientId } =
    useClientExportData();
  const input = useMemo<SprsReportInput>(
    () => ({ clientName, cmmcTarget, assessments, controls, controlsById, evidence, poam }),
    [clientName, cmmcTarget, assessments, controls, controlsById, evidence, poam],
  );
  const model = useMemo(() => buildSprsReportModel(input), [input]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const { generateSprsPdfBlob } = await import('../lib/export/sprsReportPdf');
      const { blob, filename } = await generateSprsPdfBlob(input);
      saveAs(blob, filename);
      void logEvent('report.sprs_generated', { clientId });
      onClose();
    } catch {
      setError('Could not generate the SPRS report. Please try again.');
      setBusy(false);
    }
  };

  return (
    <ExportDialog
      title="Generate SPRS Report (.pdf)"
      subtitle={`${clientName} · ${cmmcTarget} · executive summary`}
      stats={[
        { label: 'EST. SPRS', value: formatScore(model.sprs.estimatedSprsScore) },
        { label: 'READINESS', value: `${model.readinessPct}%` },
        { label: 'FINDINGS', value: model.findings.length },
      ]}
      note={
        'A 3–6 page executive report: SPRS estimate, readiness by family, top findings, and ' +
        'score-recovery opportunities. Numbers match the dashboard exactly.'
      }
      busy={busy}
      error={error}
      generateLabel="Generate report"
      onClose={onClose}
      onGenerate={generate}
    />
  );
}

export function GenerateSprsReportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn primary onClick={() => setOpen(true)}>
        Generate SPRS Report (.pdf)
      </Btn>
      {open && <SprsReportExportDialog onClose={() => setOpen(false)} />}
    </>
  );
}
