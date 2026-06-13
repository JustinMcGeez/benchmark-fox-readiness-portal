/* ============================================================================
   poamXlsx tests — assert the exceljs Workbook tree (sheet names, frozen header,
   autofilter, real date cells, styled header) and that the pure entry point
   packs to a non-empty .xlsx Blob with the canonical filename. exceljs runs in
   node, so the Blob path is exercised here (unlike the PDF, which needs a real
   browser).
   ============================================================================ */
import { describe, it, expect } from 'vitest';
import {
  buildPoamWorkbook,
  generatePoamBlob,
  poamFilename,
  POAM_COLUMNS,
} from './poamXlsx';
import { buildPoamWorkbookModel, type PoamWorkbookInput } from './poamModel';
import { CONTROLS_BY_ID, SEED_ASSESSMENTS } from '../../data/controls';
import { POAM_ITEMS } from '../../data/poam';

const input: PoamWorkbookInput = {
  clientName: 'Acme Defense Systems',
  poam: POAM_ITEMS,
  assessments: SEED_ASSESSMENTS,
  controlsById: CONTROLS_BY_ID,
  generatedAt: new Date('2026-06-13T12:00:00Z'),
};

describe('buildPoamWorkbook — structure', () => {
  const model = buildPoamWorkbookModel(input);
  const wb = buildPoamWorkbook(model);

  it('has exactly the three required sheets', () => {
    expect(wb.worksheets.map((w) => w.name)).toEqual(['POA&M', 'Closed', 'Score Impact']);
  });

  it('freezes the header row and sets an autofilter on every sheet', () => {
    for (const ws of wb.worksheets) {
      expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
      expect(ws.autoFilter).toBeTruthy();
    }
  });

  it('styles the header row navy + white bold', () => {
    const header = wb.getWorksheet('POA&M')!.getRow(1);
    const first = header.getCell(1);
    expect(first.font?.bold).toBe(true);
    expect(first.value).toBe(POAM_COLUMNS[0].header);
  });

  it('writes the scheduled completion as a real Date cell', () => {
    const ws = wb.getWorksheet('POA&M')!;
    // header is row 1; first data row is row 2.
    const dateColIndex = POAM_COLUMNS.findIndex((c) => c.key === 'scheduledCompletion') + 1;
    const cell = ws.getRow(2).getCell(dateColIndex);
    expect(cell.value).toBeInstanceOf(Date);
  });

  it('shows a placeholder row on the empty Closed sheet', () => {
    const ws = wb.getWorksheet('Closed')!;
    // 1 header + 1 placeholder = 2 rows.
    expect(ws.rowCount).toBe(2);
    expect(ws.getRow(2).getCell(1).value).toBe('No closed POA&M items.');
  });
});

describe('generatePoamBlob', () => {
  it('packs to a non-empty .xlsx Blob with the canonical filename', async () => {
    const { blob, filename } = await generatePoamBlob(input);
    expect(blob.size).toBeGreaterThan(0);
    expect(filename).toBe('Acme_Defense_Systems_POAM_2026-06-13.xlsx');
  });

  it('filename follows {slug}_{deliverable}_{date}.{ext}', () => {
    const model = buildPoamWorkbookModel(input);
    expect(poamFilename(model)).toMatch(/^Acme_Defense_Systems_POAM_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
