/* ============================================================
   localEvidenceRepository tests (Task 08) — the Local Prototype engine's
   evidence CRUD + the explicit transition() that enforces the legal state
   machine. Runs against jsdom localStorage.
   ============================================================ */
import { beforeEach, describe, expect, it } from 'vitest';
import { localEvidenceRepository, LS_EVIDENCE } from './localRepository';
import { EvidenceTransitionError } from '../../lib/evidenceWorkflow';
import { DEMO_CLIENT_ID } from '../clients';
import { EVIDENCE_ITEMS } from '../evidence';

beforeEach(() => {
  localStorage.clear();
});

describe('localEvidenceRepository — seeding + isolation', () => {
  it('seeds the demo client from EVIDENCE_ITEMS and starts other clients empty', async () => {
    const demo = await localEvidenceRepository.list(DEMO_CLIENT_ID);
    expect(demo).toHaveLength(EVIDENCE_ITEMS.length);

    const other = await localEvidenceRepository.list('some-other-client');
    expect(other).toEqual([]);
  });
});

describe('localEvidenceRepository — create / updateMetadata', () => {
  it('create() adds a Requested item scoped to the client', async () => {
    const item = await localEvidenceRepository.create('client-x', {
      controlId: '3.1.1',
      title: 'Access policy export',
      objectiveIds: ['3.1.1[a]'],
      description: 'Need the access policy',
      owner: 'IT Lead',
      dueDate: '2026-08-01',
    });
    expect(item.status).toBe('Requested');
    expect(item.controlId).toBe('3.1.1');
    expect(item.objectiveIds).toEqual(['3.1.1[a]']);

    const list = await localEvidenceRepository.list('client-x');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(item.id);
    // persisted under the per-client evidence map.
    const stored = JSON.parse(localStorage.getItem(LS_EVIDENCE) ?? '{}');
    expect(stored['client-x']).toHaveLength(1);
  });

  it('updateMetadata() patches link/quality without touching status', async () => {
    const created = await localEvidenceRepository.create('client-x', {
      controlId: '3.1.1',
      title: 'x',
    });
    const updated = await localEvidenceRepository.updateMetadata('client-x', created.id, {
      externalLink: 'https://secure.example/evidence/1',
      quality: 'Strong',
    });
    expect(updated.externalLink).toBe('https://secure.example/evidence/1');
    expect(updated.quality).toBe('Strong');
    expect(updated.status).toBe('Requested'); // unchanged
  });
});

describe('localEvidenceRepository — transition()', () => {
  it('walks a full request → accept lifecycle through legal moves', async () => {
    const created = await localEvidenceRepository.create('client-x', {
      controlId: '3.1.1',
      title: 'x',
    });
    const uploaded = await localEvidenceRepository.transition('client-x', created.id, 'Uploaded');
    expect(uploaded.status).toBe('Uploaded');
    const inReview = await localEvidenceRepository.transition('client-x', created.id, 'In Review');
    expect(inReview.status).toBe('In Review');
    const accepted = await localEvidenceRepository.transition(
      'client-x',
      created.id,
      'Accepted',
      'Looks good — covers all objectives.',
    );
    expect(accepted.status).toBe('Accepted');
    expect(accepted.notes).toBe('Looks good — covers all objectives.');
  });

  it('rejects an illegal transition with a typed EvidenceTransitionError', async () => {
    const created = await localEvidenceRepository.create('client-x', {
      controlId: '3.1.1',
      title: 'x',
    });
    // Requested → Accepted is illegal (must go Uploaded → In Review → Accepted).
    await expect(
      localEvidenceRepository.transition('client-x', created.id, 'Accepted'),
    ).rejects.toThrowError(EvidenceTransitionError);

    // unchanged on disk.
    const list = await localEvidenceRepository.list('client-x');
    expect(list[0].status).toBe('Requested');
  });

  it('rejects a transition on a missing evidence id', async () => {
    await expect(
      localEvidenceRepository.transition('client-x', 'no-such-id', 'Uploaded'),
    ).rejects.toThrow(/no longer exists/);
  });
});
