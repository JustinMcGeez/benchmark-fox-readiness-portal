/* ============================================================
   Unit tests for objective-coverage math (src/lib/objectives.ts) —
   evidence→objective mapping is METADATA ONLY (ids referencing the
   official NIST SP 800-171A objectives; no files anywhere).
   ============================================================ */
import { describe, expect, it } from 'vitest';
import { CONTROL_LIBRARY } from '../data/controls';
import type { AssessmentObjective, Control, EvidenceItem } from '../data/types';
import {
  controlObjectiveCoverage,
  coveredObjectiveIdsForControl,
  objectiveCoverageSummary,
} from './objectives';

/* ---- fixtures ---- */

const objective = (
  objectiveId: string,
  methods: AssessmentObjective['assessmentMethods'] = ['examine'],
): AssessmentObjective => ({
  objectiveId,
  objectiveText: `determination for ${objectiveId}`,
  assessmentMethods: methods,
  source: 'nist-sp-800-171a',
});

const control = (id: string, objectives: AssessmentObjective[]): Control => ({
  id,
  number: id,
  code: `AC.L2-${id}`,
  familyCode: 'AC',
  familyName: 'Access Control',
  level: 'L2',
  scoreValue: 1,
  sprsDeductionValue: -1,
  scoreSource: 'nist-sp-800-171-dod-assessment-methodology',
  title: `Control ${id}`,
  summary: 'summary',
  requirement: 'requirement',
  explanation: 'explanation',
  assessmentObjectives: objectives,
  sourceRefs: ['nist-sp-800-171r2'],
});

let nextId = 0;
const evidenceFor = (controlId: string, objectiveIds?: string[]): EvidenceItem => ({
  id: `e-${nextId++}`,
  clientId: 'test-client',
  title: `Evidence ${nextId}`,
  controlId,
  objectiveIds,
  owner: 'IT Lead',
  status: 'Accepted',
  quality: 'Strong',
  freshness: 'Current',
});

describe('coveredObjectiveIdsForControl', () => {
  it('unions objective ids across all evidence rows for the control', () => {
    const ids = coveredObjectiveIdsForControl('3.1.1', [
      evidenceFor('3.1.1', ['3.1.1[a]', '3.1.1[b]']),
      evidenceFor('3.1.1', ['3.1.1[b]', '3.1.1[c]']),
    ]);
    expect([...ids].sort()).toEqual(['3.1.1[a]', '3.1.1[b]', '3.1.1[c]']);
  });

  it('ignores other controls and evidence without objective metadata', () => {
    const ids = coveredObjectiveIdsForControl('3.1.1', [
      evidenceFor('3.1.2', ['3.1.2[a]']),
      evidenceFor('3.1.1'), // maps to the control, no objective ids
    ]);
    expect(ids.size).toBe(0);
  });
});

describe('controlObjectiveCoverage', () => {
  const c = control('3.1.1', [
    objective('3.1.1[a]', ['examine', 'interview']),
    objective('3.1.1[b]', ['test']),
  ]);

  it('reports no-objectives for an undefined or empty control', () => {
    expect(controlObjectiveCoverage(undefined, new Set()).status).toBe('no-objectives');
    expect(controlObjectiveCoverage(control('3.9.9', []), new Set()).status).toBe('no-objectives');
  });

  it('reports not-addressed when nothing is covered', () => {
    const cov = controlObjectiveCoverage(c, new Set());
    expect(cov.status).toBe('not-addressed');
    expect(cov.total).toBe(2);
    expect(cov.uncoveredIds).toEqual(['3.1.1[a]', '3.1.1[b]']);
    expect(cov.methodsCovered).toEqual([]);
  });

  it('reports partial coverage with the methods the covered objectives carry', () => {
    const cov = controlObjectiveCoverage(c, new Set(['3.1.1[a]']));
    expect(cov.status).toBe('partial');
    expect(cov.coveredIds).toEqual(['3.1.1[a]']);
    expect(cov.uncoveredIds).toEqual(['3.1.1[b]']);
    expect([...cov.methodsCovered].sort()).toEqual(['examine', 'interview']);
  });

  it('reports addressed when every objective is covered', () => {
    const cov = controlObjectiveCoverage(c, new Set(['3.1.1[a]', '3.1.1[b]']));
    expect(cov.status).toBe('addressed');
    expect(cov.uncoveredIds).toEqual([]);
    expect([...cov.methodsCovered].sort()).toEqual(['examine', 'interview', 'test']);
  });
});

describe('objectiveCoverageSummary', () => {
  const full = control('3.1.1', [objective('3.1.1[a]'), objective('3.1.1[b]')]);
  const partial = control('3.1.2', [
    objective('3.1.2[a]', ['interview']),
    objective('3.1.2[b]', ['test']),
    objective('3.1.2[c]', ['test']),
  ]);
  const uncovered = control('3.1.3', [objective('3.1.3[a]')]);
  const noObjectives = control('3.1.4', []);
  const evidence = [
    evidenceFor('3.1.1', ['3.1.1[a]', '3.1.1[b]']),
    evidenceFor('3.1.2', ['3.1.2[a]']),
  ];

  it('aggregates coverage counts, totals, and per-method counts', () => {
    const s = objectiveCoverageSummary([full, partial, uncovered, noObjectives], evidence);
    expect(s.controlsWithObjectives).toBe(3); // the empty one is excluded
    expect(s.controlsFullyCovered).toBe(1);
    expect(s.controlsPartiallyCovered).toBe(1);
    expect(s.controlsNotCovered).toBe(1);
    expect(s.totalObjectives).toBe(6);
    expect(s.coveredObjectives).toBe(3);
    expect(s.methodCounts).toEqual({ examine: 3, interview: 1, test: 2 });
  });

  it('ranks topNeedingEvidence by uncovered objective count and honors topN', () => {
    const s = objectiveCoverageSummary([full, partial, uncovered, noObjectives], evidence, 1);
    expect(s.topNeedingEvidence).toEqual([{ controlId: '3.1.2', uncovered: 2, total: 3 }]);
  });

  it('over the real library with no evidence: 110 controls, 320 official objectives, none covered', () => {
    const s = objectiveCoverageSummary(CONTROL_LIBRARY, []);
    expect(s.controlsWithObjectives).toBe(110);
    expect(s.totalObjectives).toBe(320);
    expect(s.coveredObjectives).toBe(0);
    expect(s.controlsNotCovered).toBe(110);
  });
});
