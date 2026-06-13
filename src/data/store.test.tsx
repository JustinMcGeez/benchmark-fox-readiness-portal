/* ============================================================
   Unit tests for the localStorage persistence seam (src/data/store.ts):
   loadJson/saveJson round-trips, corrupt-JSON fallback to seed data,
   and the clientId:controlId override keying — all exercised through
   the public DataProvider/useData surface.
   ============================================================ */
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { DEMO_CLIENT_ID } from './clients';
import { SEED_ASSESSMENTS } from './controls';
import { DEFAULT_INTAKE } from './intake';
import { DataProvider, useData } from './store';

const LS_ASSESS = 'bf_assessments_v1';
const LS_INTAKE = 'bf_intake_v1';

const wrapper = ({ children }: { children: ReactNode }) => <DataProvider>{children}</DataProvider>;
const mount = () => renderHook(() => useData(), { wrapper });

describe('assessment persistence (saveJson/loadJson round-trip)', () => {
  it('persists an edit and reloads it in a fresh provider', () => {
    const first = mount();
    expect(first.result.current.assessmentFor('3.1.1')?.status).toBe('Met'); // seed
    act(() => first.result.current.updateAssessment('3.1.1', { status: 'Not Met' }));
    expect(first.result.current.assessmentFor('3.1.1')?.status).toBe('Not Met');
    first.unmount();

    // fresh mount = fresh loadOverrides() from localStorage
    const second = mount();
    expect(second.result.current.assessmentFor('3.1.1')?.status).toBe('Not Met');
  });

  it('keys overrides by clientId:controlId and stores only the patch', () => {
    const { result } = mount();
    act(() => result.current.updateAssessment('3.1.1', { status: 'Partial' }));

    const raw = JSON.parse(localStorage.getItem(LS_ASSESS) ?? '{}') as Record<string, unknown>;
    expect(Object.keys(raw)).toEqual([`${DEMO_CLIENT_ID}:3.1.1`]);
    expect(raw[`${DEMO_CLIENT_ID}:3.1.1`]).toEqual({ status: 'Partial' });
  });

  it('merges the override onto the seed without losing untouched fields', () => {
    const { result } = mount();
    act(() => result.current.updateAssessment('3.1.1', { status: 'Not Met' }));
    const merged = result.current.assessmentFor('3.1.1');
    const seed = SEED_ASSESSMENTS.find((a) => a.controlId === '3.1.1');
    expect(merged?.status).toBe('Not Met');
    expect(merged?.owner).toBe(seed?.owner);
    expect(merged?.sspStatus).toBe(seed?.sspStatus);
    expect(merged?.consultantNotes).toBe(seed?.consultantNotes);
  });

  it('accumulates successive patches for the same control under one key', () => {
    const { result } = mount();
    act(() => result.current.updateAssessment('3.1.2', { status: 'Met' }));
    act(() => result.current.updateAssessment('3.1.2', { owner: 'CIO' }));
    const raw = JSON.parse(localStorage.getItem(LS_ASSESS) ?? '{}') as Record<string, unknown>;
    expect(raw[`${DEMO_CLIENT_ID}:3.1.2`]).toEqual({ status: 'Met', owner: 'CIO' });
    expect(result.current.assessmentFor('3.1.2')?.status).toBe('Met');
    expect(result.current.assessmentFor('3.1.2')?.owner).toBe('CIO');
  });

  it('ignores overrides stored for a different client', () => {
    localStorage.setItem(LS_ASSESS, JSON.stringify({ 'someone-else:3.1.2': { status: 'Met' } }));
    const { result } = mount();
    const seed = SEED_ASSESSMENTS.find((a) => a.controlId === '3.1.2');
    expect(result.current.assessmentFor('3.1.2')?.status).toBe(seed?.status);
  });

  it('falls back to the seed when stored JSON is corrupt', () => {
    localStorage.setItem(LS_ASSESS, '{this is not json');
    const { result } = mount();
    expect(result.current.assessments).toEqual(SEED_ASSESSMENTS);
  });
});

describe('intake persistence (loadJson fallback + merge semantics)', () => {
  it('round-trips intake edits through localStorage', () => {
    const first = mount();
    act(() => first.result.current.updateIntake({ estimatedScope: 'Whole network' }));
    first.unmount();
    const second = mount();
    expect(second.result.current.intake.estimatedScope).toBe('Whole network');
  });

  it('merges a partial stored value over the defaults', () => {
    localStorage.setItem(LS_INTAKE, JSON.stringify({ likelyPath: 'Level 1 · Self-Assessment' }));
    const { result } = mount();
    expect(result.current.intake.likelyPath).toBe('Level 1 · Self-Assessment');
    expect(result.current.intake.estimatedScope).toBe(DEFAULT_INTAKE.estimatedScope);
    expect(result.current.intake.contractClauses).toEqual(DEFAULT_INTAKE.contractClauses);
  });

  it('falls back to DEFAULT_INTAKE when stored JSON is corrupt', () => {
    localStorage.setItem(LS_INTAKE, 'not-json{{{');
    const { result } = mount();
    expect(result.current.intake).toEqual(DEFAULT_INTAKE);
  });
});
