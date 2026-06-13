/* ============================================================================
   POA&M .xlsx renderer — turns the pure PoamWorkbookModel (poamModel.ts) into a
   styled exceljs Workbook and a downloadable Blob. CLIENT-SIDE generation only:
   no server render, no Supabase storage — the workbook is the CLIENT'S document
   and is never persisted by this product.

   Three sheets: "POA&M" (open items), "Closed" (closed/validated), and
   "Score Impact" (per open item, the SPRS deduction + projected remediated
   score from the isolated scoring engine). Header rows are navy/white, frozen,
   and auto-filtered; dates are real date cells; milestone cells wrap.

   `buildPoamWorkbook` is the testable tree builder; `generatePoamBlob` is the
   pure entry point (data in → Blob out).
   ============================================================================ */
import * as ExcelJS from 'exceljs';
import {
  buildPoamWorkbookModel,
  type PoamRowModel,
  type PoamWorkbookInput,
  type PoamWorkbookModel,
  type ScoreImpactRowModel,
} from './poamModel';
import { exportFilename, NAVY, WHITE } from './common';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** One workbook column: header label, row-object key, width, and formatting. */
interface ColSpec {
  header: string;
  key: string;
  width: number;
  wrap?: boolean;
  date?: boolean;
}

/** The DoD/eMASS-style POA&M columns (open + closed sheets share these). */
export const POAM_COLUMNS: ColSpec[] = [
  { header: 'Item ID', key: 'itemId', width: 12 },
  { header: 'Control #', key: 'controlId', width: 12 },
  { header: 'Weakness Description', key: 'weakness', width: 46, wrap: true },
  { header: 'Severity / Risk', key: 'severity', width: 14 },
  { header: 'Source of Weakness', key: 'source', width: 22, wrap: true },
  { header: 'Resources Required', key: 'resources', width: 24, wrap: true },
  { header: 'Scheduled Completion', key: 'scheduledCompletion', width: 18, date: true },
  { header: 'Milestones (with dates)', key: 'milestones', width: 42, wrap: true },
  { header: 'Milestone Changes', key: 'milestoneChanges', width: 24, wrap: true },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Comments', key: 'comments', width: 42, wrap: true },
];

/** The Score Impact sheet columns. */
export const SCORE_IMPACT_COLUMNS: ColSpec[] = [
  { header: 'Item ID', key: 'itemId', width: 12 },
  { header: 'Control #', key: 'controlId', width: 12 },
  { header: 'Current Status', key: 'currentStatus', width: 16 },
  { header: 'SPRS Deduction', key: 'deduction', width: 16 },
  { header: 'Current Est. Score', key: 'currentScore', width: 18 },
  { header: 'Projected Score (if remediated)', key: 'projectedScore', width: 30 },
];

type CellValue = string | number | Date;

function poamRowValues(r: PoamRowModel): Record<string, CellValue> {
  return {
    itemId: r.itemId,
    controlId: r.controlId,
    weakness: r.weakness,
    severity: r.severity,
    source: r.source,
    resources: r.resources,
    // Real Date cell when parseable; otherwise the original string / placeholder.
    scheduledCompletion: r.scheduledCompletion ?? (r.scheduledCompletionRaw || '—'),
    milestones: r.milestones,
    milestoneChanges: r.milestoneChanges,
    status: r.status,
    comments: r.comments,
  };
}

function scoreRowValues(r: ScoreImpactRowModel): Record<string, CellValue> {
  return {
    itemId: r.itemId,
    controlId: r.controlId,
    currentStatus: r.currentStatus,
    // Signed deduction (negative magnitude) so Excel shows e.g. -3; 0 when none.
    deduction: r.deduction === 0 ? 0 : -r.deduction,
    currentScore: r.currentScore,
    projectedScore: r.projectedScore,
  };
}

/** Add a styled, frozen, auto-filtered sheet (or a single placeholder row). */
function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  cols: ColSpec[],
  rows: Array<Record<string, CellValue>>,
  emptyMessage: string,
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  if (rows.length === 0) {
    ws.addRow({ [cols[0].key]: emptyMessage });
  } else {
    for (const r of rows) ws.addRow(r);
  }

  // Column-level formatting first (sets each column's default cell style)…
  for (const c of cols) {
    const col = ws.getColumn(c.key);
    if (c.wrap) col.alignment = { wrapText: true, vertical: 'top' };
    if (c.date) col.numFmt = 'mm/dd/yyyy';
  }

  // …then the header row LAST so its explicit style wins over the column default.
  const headerRow = ws.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } };
    cell.font = { bold: true, color: { argb: `FF${WHITE}` }, size: 11 };
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' };
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return ws;
}

/** Build the exceljs Workbook tree from the model (no byte rendering). */
export function buildPoamWorkbook(model: PoamWorkbookModel): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Benchmark Fox Readiness Portal';
  wb.created = model.meta.generatedAt;
  wb.title = `POA&M — ${model.meta.clientName}`;

  addSheet(wb, 'POA&M', POAM_COLUMNS, model.open.map(poamRowValues), 'No open POA&M items.');
  addSheet(wb, 'Closed', POAM_COLUMNS, model.closed.map(poamRowValues), 'No closed POA&M items.');
  addSheet(
    wb,
    'Score Impact',
    SCORE_IMPACT_COLUMNS,
    model.scoreImpact.map(scoreRowValues),
    'No open POA&M items to score.',
  );
  return wb;
}

/** Suggested download filename, e.g. "Acme_Defense_POAM_2026-06-13.xlsx". */
export function poamFilename(model: PoamWorkbookModel): string {
  return exportFilename(model.meta.clientName, 'POAM', 'xlsx', model.meta.generatedAt);
}

/** PURE entry point: POA&M data in → .xlsx Blob out. No DOM, no storage. */
export async function generatePoamBlob(
  input: PoamWorkbookInput,
): Promise<{ blob: Blob; filename: string }> {
  const model = buildPoamWorkbookModel(input);
  const wb = buildPoamWorkbook(model);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  return { blob, filename: poamFilename(model) };
}
