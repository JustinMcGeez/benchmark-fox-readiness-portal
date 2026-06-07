/* ============================================================
   Source reference registry.

   Every official document the app's content/data modeling is based on.
   Screens cite these by sourceId so the user can always see which
   authoritative source backs a given data point.
   ============================================================ */

export type DocumentType =
  | 'NIST Special Publication'
  | 'Federal Regulation'
  | 'DFARS Clause'
  | 'CFR'
  | 'DoD Guidance'
  | 'CMMC Guidance'
  | 'Registry'
  | 'Benchmark Fox Internal';

export interface SourceRef {
  sourceId: string;
  sourceName: string;
  publisher: string;
  documentType: DocumentType;
  version?: string;
  url?: string;
  reference?: string; // section / page / clause
  notes?: string;
}

export const SOURCE_REFS: SourceRef[] = [
  {
    sourceId: 'nist-sp-800-171r2',
    sourceName: 'NIST SP 800-171 Rev. 2 — Protecting CUI in Nonfederal Systems',
    publisher: 'NIST',
    documentType: 'NIST Special Publication',
    version: 'Revision 2 (Feb 2020)',
    url: 'https://csrc.nist.gov/pubs/sp/800/171/r2/upd1/final',
    reference: '§3.1–§3.14 security requirements',
    notes: 'Requirement text is reproduced verbatim (public-domain U.S. Government work).',
  },
  {
    sourceId: 'nist-sp-800-171a',
    sourceName: 'NIST SP 800-171A — Assessing Security Requirements for CUI',
    publisher: 'NIST',
    documentType: 'NIST Special Publication',
    version: 'June 2018',
    url: 'https://csrc.nist.gov/pubs/sp/800/171/a/final',
    reference: 'Assessment objectives & methods',
    notes: 'Assessment objectives are not bundled locally yet — shown as placeholders.',
  },
  {
    sourceId: 'dod-assessment-methodology',
    sourceName: 'NIST SP 800-171 DoD Assessment Methodology',
    publisher: 'DoD (OUSD A&S)',
    documentType: 'DoD Guidance',
    version: 'v1.2.1',
    reference: 'Annex A — scoring values',
    notes: 'Official SPRS deduction values (5/3/1) come from here. Not bundled — scoreValue is a placeholder until imported.',
  },
  {
    sourceId: 'far-52-204-21',
    sourceName: 'FAR 52.204-21 — Basic Safeguarding of Covered Contractor Information Systems',
    publisher: 'GSA / FAR Council',
    documentType: 'Federal Regulation',
    reference: '15 basic safeguarding requirements',
    notes: 'Basis for CMMC Level 1; maps to 17 NIST SP 800-171 requirements.',
  },
  {
    sourceId: 'dfars-252-204-7012',
    sourceName: 'DFARS 252.204-7012 — Safeguarding Covered Defense Information',
    publisher: 'DoD',
    documentType: 'DFARS Clause',
    notes: 'Requires NIST SP 800-171 implementation and cyber incident reporting.',
  },
  {
    sourceId: 'dfars-252-204-7019',
    sourceName: 'DFARS 252.204-7019 — Notice of NIST SP 800-171 DoD Assessment Requirements',
    publisher: 'DoD',
    documentType: 'DFARS Clause',
  },
  {
    sourceId: 'dfars-252-204-7020',
    sourceName: 'DFARS 252.204-7020 — NIST SP 800-171 DoD Assessment Requirements',
    publisher: 'DoD',
    documentType: 'DFARS Clause',
  },
  {
    sourceId: 'dfars-252-204-7021',
    sourceName: 'DFARS 252.204-7021 — Cybersecurity Maturity Model Certification (CMMC) Requirements',
    publisher: 'DoD',
    documentType: 'DFARS Clause',
    notes: 'Contractual CMMC level requirement clause.',
  },
  {
    sourceId: '32-cfr-part-170',
    sourceName: '32 CFR Part 170 — Cybersecurity Maturity Model Certification (CMMC) Program',
    publisher: 'DoD',
    documentType: 'CFR',
    notes: 'CMMC program rule — levels, scoping, assessment requirements.',
  },
  {
    sourceId: 'cmmc-l2-scoping',
    sourceName: 'CMMC Level 2 Scoping Guidance',
    publisher: 'DoD CIO',
    documentType: 'CMMC Guidance',
    notes: 'Asset categories and assessment scope definitions.',
  },
  {
    sourceId: 'cmmc-l2-assessment',
    sourceName: 'CMMC Level 2 Assessment Guide',
    publisher: 'DoD CIO',
    documentType: 'CMMC Guidance',
  },
  {
    sourceId: 'cmmc-l1-scoping',
    sourceName: 'CMMC Level 1 Scoping Guidance',
    publisher: 'DoD CIO',
    documentType: 'CMMC Guidance',
  },
  {
    sourceId: 'nara-cui-registry',
    sourceName: 'NARA CUI Registry',
    publisher: 'NARA',
    documentType: 'Registry',
    url: 'https://www.archives.gov/cui',
    notes: 'Authoritative list of CUI categories.',
  },
  {
    sourceId: 'cui-poam-template',
    sourceName: 'CUI Plan of Action (POA&M) Template',
    publisher: 'DoD / NIST',
    documentType: 'DoD Guidance',
    notes: 'Field structure for POA&M items.',
  },
  {
    sourceId: 'bf-internal',
    sourceName: 'Benchmark Fox internal artifacts (intake, SSP/POA&M templates, data-handling)',
    publisher: 'Benchmark Fox',
    documentType: 'Benchmark Fox Internal',
    notes: 'Plain-English explanations, evidence examples, and guidance are Benchmark Fox-authored, not official.',
  },
  {
    sourceId: 'bf-ssp-template',
    sourceName: 'Benchmark Fox SSP Template & Language Guide',
    publisher: 'Benchmark Fox',
    documentType: 'Benchmark Fox Internal',
    notes: 'Reusable SSP implementation-statement language — Benchmark Fox-authored, not official.',
  },
  {
    sourceId: 'bf-poam-template',
    sourceName: 'Benchmark Fox POA&M Template',
    publisher: 'Benchmark Fox',
    documentType: 'Benchmark Fox Internal',
    notes: 'POA&M structure aligned to the CUI Plan of Action template — Benchmark Fox-authored.',
  },
  {
    sourceId: 'bf-evidence-guidance',
    sourceName: 'Benchmark Fox Evidence Collection Guidance',
    publisher: 'Benchmark Fox',
    documentType: 'Benchmark Fox Internal',
    notes: 'Evidence examples and quality criteria — Benchmark Fox-authored, not official.',
  },
];

export const SOURCE_BY_ID: Record<string, SourceRef> = Object.fromEntries(
  SOURCE_REFS.map((s) => [s.sourceId, s]),
);

export const getSources = (ids: string[]): SourceRef[] =>
  ids.map((id) => SOURCE_BY_ID[id]).filter((s): s is SourceRef => Boolean(s));
