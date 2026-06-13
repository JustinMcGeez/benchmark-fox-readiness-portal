/* ============================================================
   Unit tests for the evidence state machine (src/lib/evidenceWorkflow.ts) —
   the single source of truth for legal transitions, role-gating, and the
   read-time expiry derivation (Task 08).
   ============================================================ */
import { describe, expect, it } from 'vitest';
import type { EvidenceItem, EvidenceStatus } from '../data/types';
import { EVIDENCE_OPTIONS } from '../data/types';
import {
  allowedNextStatuses,
  assertTransition,
  canTransition,
  effectiveFreshness,
  effectiveStatus,
  EVIDENCE_TRANSITIONS,
  EvidenceTransitionError,
  isExpired,
  isReviewerOnlyStatus,
  isEvidenceTransitionError,
  nextStatuses,
  REVIEWER_ONLY_STATUSES,
} from './evidenceWorkflow';

const ALL_STATUSES = EVIDENCE_OPTIONS;

/** The exact legal moves from the task spec, as [from, to] pairs. */
const LEGAL_MOVES: [EvidenceStatus, EvidenceStatus][] = [
  ['Not Requested', 'Requested'],
  ['Requested', 'Uploaded'],
  ['Requested', 'Missing'],
  ['Uploaded', 'In Review'],
  ['In Review', 'Accepted'],
  ['In Review', 'Needs Revision'],
  ['In Review', 'Rejected'],
  ['Needs Revision', 'Uploaded'],
  ['Accepted', 'Expired'],
  ['Expired', 'Requested'],
];

describe('transition map — legality', () => {
  it('accepts EVERY legal move in the spec', () => {
    for (const [from, to] of LEGAL_MOVES) {
      expect(canTransition(from, to), `${from} → ${to} should be legal`).toBe(true);
      expect(() => assertTransition(from, to)).not.toThrow();
    }
  });

  it('rejects every from→to pair NOT in the legal set (exhaustive)', () => {
    const legal = new Set(LEGAL_MOVES.map(([f, t]) => `${f}→${t}`));
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const expected = legal.has(`${from}→${to}`);
        expect(canTransition(from, to), `${from} → ${to}`).toBe(expected);
      }
    }
  });

  it('treats Missing and Rejected as terminal (no out-edges)', () => {
    expect(nextStatuses('Missing')).toEqual([]);
    expect(nextStatuses('Rejected')).toEqual([]);
  });

  it('assertTransition throws a typed EvidenceTransitionError on an illegal move', () => {
    try {
      assertTransition('Accepted', 'Requested'); // not legal (Accepted → Expired only)
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(isEvidenceTransitionError(e)).toBe(true);
      expect((e as EvidenceTransitionError).from).toBe('Accepted');
      expect((e as EvidenceTransitionError).to).toBe('Requested');
    }
  });

  it('every status in the map is a real EvidenceStatus and all are covered', () => {
    const keys = Object.keys(EVIDENCE_TRANSITIONS).sort();
    expect(keys).toEqual([...ALL_STATUSES].sort());
  });
});

describe('role-gated transitions', () => {
  it('REVIEWER_ONLY_STATUSES is exactly the four review-stage statuses', () => {
    expect([...REVIEWER_ONLY_STATUSES].sort()).toEqual(
      ['Accepted', 'In Review', 'Needs Revision', 'Rejected'].sort(),
    );
    for (const s of ['Accepted', 'In Review', 'Needs Revision', 'Rejected'] as EvidenceStatus[]) {
      expect(isReviewerOnlyStatus(s)).toBe(true);
    }
    for (const s of ['Requested', 'Uploaded', 'Missing', 'Expired', 'Not Requested'] as EvidenceStatus[]) {
      expect(isReviewerOnlyStatus(s)).toBe(false);
    }
  });

  it('a reviewer sees all legal next statuses', () => {
    expect(allowedNextStatuses('In Review', true)).toEqual([
      'Accepted',
      'Needs Revision',
      'Rejected',
    ]);
    expect(allowedNextStatuses('Uploaded', true)).toEqual(['In Review']);
  });

  it('a non-reviewer (uploader/client) never sees review-only targets', () => {
    // Uploaded → In Review is reviewer-only, so an uploader sees nothing here.
    expect(allowedNextStatuses('Uploaded', false)).toEqual([]);
    // In Review → {Accepted, Needs Revision, Rejected} are all reviewer-only.
    expect(allowedNextStatuses('In Review', false)).toEqual([]);
    // But an uploader CAN provide the artifact (Requested → Uploaded/Missing).
    expect(allowedNextStatuses('Requested', false)).toEqual(['Uploaded', 'Missing']);
    expect(allowedNextStatuses('Needs Revision', false)).toEqual(['Uploaded']);
  });
});

describe('read-time expiry derivation', () => {
  const ev = (over: Partial<EvidenceItem>): EvidenceItem => ({
    id: 'e1',
    clientId: 'c1',
    title: 'x',
    controlId: '3.1.1',
    owner: 'IT',
    status: 'Accepted',
    quality: 'Strong',
    freshness: 'Current',
    ...over,
  });
  const now = new Date('2026-06-13T12:00:00Z');

  it('Accepted past its expiry derives to Expired', () => {
    const item = ev({ status: 'Accepted', expiresOn: '2026-01-01' });
    expect(isExpired(item, now)).toBe(true);
    expect(effectiveStatus(item, now)).toBe('Expired');
    expect(effectiveFreshness(item, now)).toBe('Expired');
  });

  it('Accepted before its expiry stays Accepted/Current', () => {
    const item = ev({ status: 'Accepted', expiresOn: '2027-01-01' });
    expect(isExpired(item, now)).toBe(false);
    expect(effectiveStatus(item, now)).toBe('Accepted');
    expect(effectiveFreshness(item, now)).toBe('Current');
  });

  it('non-Accepted statuses are never derived to Expired by expiry', () => {
    const item = ev({ status: 'In Review', expiresOn: '2020-01-01' });
    expect(isExpired(item, now)).toBe(false);
    expect(effectiveStatus(item, now)).toBe('In Review');
  });

  it('no expiry date → stored status / freshness pass through', () => {
    const item = ev({ status: 'Accepted', expiresOn: undefined, freshness: 'N/A' });
    expect(isExpired(item, now)).toBe(false);
    expect(effectiveStatus(item, now)).toBe('Accepted');
    expect(effectiveFreshness(item, now)).toBe('N/A');
  });

  it('an expiry exactly today is not yet expired (expires once past)', () => {
    const item = ev({ status: 'Accepted', expiresOn: '2026-06-13' });
    expect(isExpired(item, now)).toBe(false);
  });

  it('an invalid expiry string is ignored', () => {
    const item = ev({ status: 'Accepted', expiresOn: 'not-a-date' });
    expect(isExpired(item, now)).toBe(false);
    expect(effectiveFreshness(item, now)).toBe('Current'); // falls back to stored
  });
});
