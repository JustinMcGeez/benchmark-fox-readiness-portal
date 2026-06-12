/* ============================================================
   Unit tests for the derived selectors (src/lib/selectors.ts) —
   open POA&M counts, blockers, missing/weak evidence, and the
   topFindings aggregation that drives the executive report.
   ============================================================ */
import { describe, expect, it } from 'vitest';
import { CONTROLS_BY_ID } from '../data/controls';
import type {
  ClientControlAssessment,
  EvidenceItem,
  PoamItem,
  PoamStatus,
  TaskItem,
} from '../data/types';
import {
  blockerItems,
  missingEvidenceCount,
  nextActions,
  openPoamItems,
  openTaskCount,
  priorityRank,
  topBlockers,
  topFindings,
  weakEvidenceCount,
} from './selectors';

/* ---- fixtures ---- */

let nextId = 0;
const poam = (p: Partial<PoamItem>): PoamItem => ({
  id: `p-${nextId++}`,
  clientId: 'test-client',
  controlId: '3.1.1',
  weakness: 'weakness',
  owner: 'IT Lead',
  risk: 'Medium',
  dueDate: '08/15/2026',
  status: 'Ongoing',
  classification: 'Readiness',
  ...p,
});

const evidence = (e: Partial<EvidenceItem>): EvidenceItem => ({
  id: `e-${nextId++}`,
  clientId: 'test-client',
  title: `Evidence ${nextId}`,
  controlId: '3.1.1',
  owner: 'IT Lead',
  status: 'Accepted',
  quality: 'Strong',
  freshness: 'Current',
  ...e,
});

const task = (t: Partial<TaskItem>): TaskItem => ({
  id: `t-${nextId++}`,
  clientId: 'test-client',
  title: `Task ${nextId}`,
  owner: 'IT Lead',
  priority: 'Medium',
  dueDate: '08/15/2026',
  status: 'In Progress',
  ...t,
});

const assessment = (a: Partial<ClientControlAssessment>): ClientControlAssessment => ({
  clientId: 'test-client',
  controlId: '3.1.1',
  status: 'Met',
  sspStatus: 'Complete',
  evidenceStatus: 'Accepted',
  poamStatus: 'None',
  risk: 'Low',
  owner: 'IT Lead',
  ...a,
});

describe('open POA&M / blocker selectors', () => {
  it('openPoamItems keeps only Not Started / Ongoing / Blocked', () => {
    const open: PoamStatus[] = ['Not Started', 'Ongoing', 'Blocked'];
    const closed: PoamStatus[] = ['None', 'Complete', 'Validated', 'Closed'];
    const items = [...open, ...closed].map((status) => poam({ status }));
    expect(openPoamItems(items).map((p) => p.status)).toEqual(open);
  });

  it('blockerItems keeps only classification === Blocker', () => {
    const items = [
      poam({ classification: 'Blocker' }),
      poam({ classification: 'Readiness' }),
      poam({ classification: 'Internal' }),
    ];
    const blockers = blockerItems(items);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].classification).toBe('Blocker');
  });

  it('topBlockers ranks blockers first, then by risk, and respects the limit', () => {
    const items = [
      poam({ classification: 'Readiness', risk: 'Critical' }),
      poam({ classification: 'Blocker', risk: 'Medium' }),
      poam({ classification: 'Blocker', risk: 'High' }),
      poam({ classification: 'Internal', risk: 'Low' }),
    ];
    const top = topBlockers(items, 3);
    expect(top.map((p) => [p.classification, p.risk])).toEqual([
      ['Blocker', 'High'],
      ['Blocker', 'Medium'],
      ['Readiness', 'Critical'],
    ]);
  });
});

describe('evidence + task counts', () => {
  it('missingEvidenceCount counts Missing and Requested statuses', () => {
    const items = [
      evidence({ status: 'Missing' }),
      evidence({ status: 'Requested' }),
      evidence({ status: 'Accepted' }),
      evidence({ status: 'In Review' }),
    ];
    expect(missingEvidenceCount(items)).toBe(2);
  });

  it('weakEvidenceCount counts Weak, Missing, and Outdated quality', () => {
    const items = [
      evidence({ quality: 'Weak' }),
      evidence({ quality: 'Missing' }),
      evidence({ quality: 'Outdated' }),
      evidence({ quality: 'Strong' }),
      evidence({ quality: 'Acceptable' }),
    ];
    expect(weakEvidenceCount(items)).toBe(3);
  });

  it('openTaskCount counts everything not Done', () => {
    const tasks = [
      task({ status: 'Not Started' }),
      task({ status: 'In Progress' }),
      task({ status: 'Blocked' }),
      task({ status: 'Done' }),
    ];
    expect(openTaskCount(tasks)).toBe(3);
  });

  it('nextActions returns open tasks by priority, limited to n', () => {
    const tasks = [
      task({ status: 'Done', priority: 'Critical' }),
      task({ status: 'Not Started', priority: 'Low' }),
      task({ status: 'In Progress', priority: 'High' }),
      task({ status: 'Blocked', priority: 'Critical' }),
    ];
    const next = nextActions(tasks, 2);
    expect(next.map((t) => t.priority)).toEqual(['Critical', 'High']);
    expect(next.every((t) => t.status !== 'Done')).toBe(true);
  });

  it('priorityRank orders Critical > High > Medium > Low and defaults unknown to 0', () => {
    expect(priorityRank('Critical')).toBeGreaterThan(priorityRank('High'));
    expect(priorityRank('High')).toBeGreaterThan(priorityRank('Medium'));
    expect(priorityRank('Medium')).toBeGreaterThan(priorityRank('Low'));
    expect(priorityRank('Unknown')).toBe(0);
  });
});

describe('topFindings — executive report aggregation', () => {
  it('orders findings by severity: blockers, critical gaps, high gaps, SSP, evidence', () => {
    const findings = topFindings(
      [
        assessment({ controlId: '3.1.3', status: 'Not Met', risk: 'Critical' }),
        assessment({ controlId: '3.3.1', status: 'Not Met', risk: 'High' }),
        assessment({ controlId: '3.6.1', sspStatus: 'Missing' }),
      ],
      [poam({ controlId: '3.13.11', classification: 'Blocker', weakness: 'FIPS crypto absent' })],
      [evidence({ title: 'MFA evidence', status: 'Missing', quality: 'Missing' })],
      CONTROLS_BY_ID,
    );
    expect(findings.map((f) => f.severity)).toEqual([6, 5, 4, 3, 2]);
    expect(findings[0].text).toContain('POA&M blocker');
    expect(findings[0].text).toContain('FIPS crypto absent');
    expect(findings[1].text).toContain('3.1.3');
    expect(findings[1].text).toContain(CONTROLS_BY_ID['3.1.3'].title);
  });

  it('only counts Not Met controls when risk is High or Critical', () => {
    const findings = topFindings(
      [
        assessment({ controlId: '3.1.1', status: 'Not Met', risk: 'Medium' }),
        assessment({ controlId: '3.1.2', status: 'Partial', risk: 'Critical' }),
      ],
      [],
      [],
      CONTROLS_BY_ID,
    );
    expect(findings.filter((f) => f.id.startsWith('ctl-'))).toHaveLength(0);
  });

  it('deduplicates identical finding text and caps the list at n', () => {
    const dupes = [
      evidence({ title: 'Same gap', status: 'Missing' }),
      evidence({ title: 'Same gap', status: 'Missing' }),
    ];
    expect(topFindings([], [], dupes, CONTROLS_BY_ID)).toHaveLength(1);

    const many = Array.from({ length: 8 }, (_, i) =>
      poam({ classification: 'Blocker', weakness: `Weakness ${i}` }),
    );
    expect(topFindings([], many, [], CONTROLS_BY_ID, 5)).toHaveLength(5);
  });
});
