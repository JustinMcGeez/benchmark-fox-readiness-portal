/* Seed data — available Benchmark Fox report deliverables. */
import type { ReportItem } from './types';

export const REPORTS: ReportItem[] = [
  { id: 'rpt-exec', title: 'Executive Readiness Summary', description: 'High-level leadership report' },
  { id: 'rpt-gap', title: 'Detailed Gap Assessment', description: 'Control-by-control report' },
  { id: 'rpt-poam', title: 'POA&M Summary', description: 'Remediation tracker export' },
  { id: 'rpt-evidence', title: 'Evidence Gap Report', description: 'Missing / weak evidence report' },
  { id: 'rpt-sprs', title: 'SPRS Score Summary', description: 'Current score and deltas' },
  { id: 'rpt-gng', title: 'Final Go/No-Go Memo', description: 'C3PAO readiness decision' },
  { id: 'rpt-roadmap', title: 'Remediation Roadmap', description: 'Sequenced action plan' },
  { id: 'rpt-checklist', title: 'C3PAO Readiness Checklist', description: 'Pre-assessment checklist' },
];

export const EXPORT_FORMATS = ['PDF', 'DOCX', 'XLSX / CSV Matrix', 'ZIP Evidence Binder'];
