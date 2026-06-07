/* ============================================================
   Derived selectors over the seed data — single source of truth for
   the counts and lists shown on the dashboards, so every screen agrees.
   ============================================================ */
import type { EvidenceItem, PoamItem, RiskLevel, TaskItem } from '../data/types';

const POAM_OPEN = new Set<PoamItem['status']>(['Not Started', 'Ongoing', 'Blocked']);

export const priorityRank = (p: RiskLevel | string): number =>
  ({ Critical: 3, High: 2, Medium: 1, Low: 0 })[p as RiskLevel] ?? 0;

export const openPoamItems = (items: PoamItem[]): PoamItem[] =>
  items.filter((p) => POAM_OPEN.has(p.status));

export const blockerItems = (items: PoamItem[]): PoamItem[] =>
  items.filter((p) => p.classification === 'Blocker');

export const missingEvidenceCount = (items: EvidenceItem[]): number =>
  items.filter((e) => e.status === 'Missing' || e.status === 'Requested').length;

export const weakEvidenceCount = (items: EvidenceItem[]): number =>
  items.filter((e) => e.quality === 'Weak' || e.quality === 'Missing' || e.quality === 'Outdated').length;

export const openTaskCount = (tasks: TaskItem[]): number =>
  tasks.filter((t) => t.status !== 'Done').length;

export const topBlockers = (items: PoamItem[], n = 4): PoamItem[] =>
  [...items]
    .sort(
      (a, b) =>
        Number(b.classification === 'Blocker') - Number(a.classification === 'Blocker') ||
        priorityRank(b.risk) - priorityRank(a.risk),
    )
    .slice(0, n);

export const nextActions = (tasks: TaskItem[], n = 3): TaskItem[] =>
  [...tasks]
    .filter((t) => t.status !== 'Done')
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
    .slice(0, n);
