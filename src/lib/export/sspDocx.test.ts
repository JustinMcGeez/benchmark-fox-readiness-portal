/* ============================================================================
   sspDocx tests — smoke-test the docx layer: the model packs into a real Word
   document Blob without throwing (exercises every paragraph/table builder over
   all 110 sections) and the suggested filename is sane. We do NOT parse the
   rendered bytes — content assertions live in sspModel.test.ts.
   ============================================================================ */
import { describe, it, expect } from 'vitest';
import { Document } from 'docx';
import { buildSspDocxDocument, generateSspBlob, sspFilename } from './sspDocx';
import { buildSspModel, type SspInput } from './sspModel';
import { CONTROL_LIBRARY, SEED_ASSESSMENTS } from '../../data/controls';
import { POAM_ITEMS } from '../../data/poam';
import { DEFAULT_INTAKE } from '../../data/intake';
import { DEFAULT_SCOPE } from '../../data/scope';

const input: SspInput = {
  clientName: 'Acme Defense Systems',
  systemName: 'Acme CUI Enclave',
  cmmcTarget: 'Level 2',
  intake: DEFAULT_INTAKE,
  scope: DEFAULT_SCOPE,
  assessments: SEED_ASSESSMENTS,
  controls: CONTROL_LIBRARY,
  evidence: [],
  poam: POAM_ITEMS,
  version: '1.0',
  generatedAt: new Date('2026-06-13T12:00:00Z'),
};

describe('buildSspDocxDocument', () => {
  it('builds a docx Document from the full 110-control model without throwing', () => {
    const model = buildSspModel(input);
    const doc = buildSspDocxDocument(model);
    expect(doc).toBeInstanceOf(Document);
  });
});

describe('generateSspBlob', () => {
  it('packs the document into a non-empty Blob', async () => {
    const { blob, filename } = await generateSspBlob(input);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(filename).toMatch(/\.docx$/);
  });

  it('completes well under the 3s budget for 110 sections', async () => {
    const start = Date.now();
    await generateSspBlob(input);
    expect(Date.now() - start).toBeLessThan(3000);
  });
});

describe('sspFilename', () => {
  it('slugs the client name and stamps the date', () => {
    const model = buildSspModel(input);
    expect(sspFilename(model)).toBe('SSP_Acme_Defense_Systems_2026-06-13.docx');
  });
});
