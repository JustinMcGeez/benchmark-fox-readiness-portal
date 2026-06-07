/* Seed data — available Benchmark Fox report deliverables. */
import type { ReportItem } from './types';

export const REPORTS: ReportItem[] = [
  {
    id: 'rpt-exec',
    title: 'Executive Readiness Summary',
    description: 'High-level leadership report',
    feeds: ['Readiness %', 'Score by family', 'Top blockers'],
  },
  {
    id: 'rpt-gap',
    title: 'Detailed Gap Assessment',
    description: 'Control-by-control report',
    feeds: ['Control assessments', 'SSP status', 'Evidence status'],
  },
  {
    id: 'rpt-poam',
    title: 'POA&M Summary',
    description: 'Remediation tracker export',
    feeds: ['POA&M items', 'Milestones', 'Owners'],
  },
  {
    id: 'rpt-evidence',
    title: 'Evidence Gap Report',
    description: 'Missing / weak evidence report',
    feeds: ['Evidence items', 'Quality', 'Freshness'],
  },
  {
    id: 'rpt-sprs',
    title: 'SPRS Score Summary',
    description: 'Current score and deltas',
    feeds: ['SPRS score (placeholder)', 'Deductions'],
  },
  {
    id: 'rpt-gng',
    title: 'Final Go/No-Go Memo',
    description: 'C3PAO readiness decision',
    feeds: ['Readiness %', 'Critical blockers', 'Open POA&Ms'],
  },
  {
    id: 'rpt-roadmap',
    title: 'Remediation Roadmap',
    description: 'Sequenced action plan',
    feeds: ['Tasks', 'POA&M milestones', 'Due dates'],
  },
  {
    id: 'rpt-checklist',
    title: 'C3PAO Readiness Checklist',
    description: 'Pre-assessment checklist',
    feeds: ['Control assessments', 'Evidence', 'SSP'],
  },
];

export const EXPORT_FORMATS = ['PDF', 'DOCX', 'XLSX / CSV Matrix', 'ZIP Evidence Binder'];
