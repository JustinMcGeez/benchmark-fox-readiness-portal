/* ============================================================
   auditLog tests — the diff renderer + action/field humanizers and
   the row→entry mapper. Pure functions; no Supabase, no React.
   ============================================================ */
import { describe, expect, it } from 'vitest';
import {
  auditDiffLines,
  auditRowToEntry,
  formatAuditTimestamp,
  formatAuditValue,
  formatFieldLabel,
  humanizeAuditAction,
  parseAuditDiff,
  type AuditEventRow,
} from './auditLog';

describe('humanizeAuditAction', () => {
  it('maps known actions to friendly labels', () => {
    expect(humanizeAuditAction('assessment.updated')).toBe('Assessment updated');
    expect(humanizeAuditAction('intake.saved')).toBe('Intake saved');
    expect(humanizeAuditAction('evidence.status_changed')).toBe('Evidence status changed');
    expect(humanizeAuditAction('auth.signed_in')).toBe('Signed in');
  });

  it('prettifies unknown actions instead of dumping the raw key', () => {
    expect(humanizeAuditAction('widget.frobnicated')).toBe('Widget frobnicated');
  });
});

describe('formatFieldLabel', () => {
  it('maps known DB columns to labels (incl. SSP / POA&M casing)', () => {
    expect(formatFieldLabel('readiness_status')).toBe('Readiness status');
    expect(formatFieldLabel('ssp_status')).toBe('SSP status');
    expect(formatFieldLabel('poam_status')).toBe('POA&M status');
    expect(formatFieldLabel('owner_name')).toBe('Owner');
  });

  it('prettifies unknown columns', () => {
    expect(formatFieldLabel('some_new_column')).toBe('Some new column');
  });
});

describe('formatAuditValue', () => {
  it('renders scalars and a placeholder for missing/empty values', () => {
    expect(formatAuditValue(null)).toBe('—');
    expect(formatAuditValue('')).toBe('—');
    expect(formatAuditValue('Partial')).toBe('Partial');
    expect(formatAuditValue(true)).toBe('Yes');
    expect(formatAuditValue(false)).toBe('No');
    expect(formatAuditValue(12)).toBe('12');
  });

  it('never dumps raw JSON for containers', () => {
    expect(formatAuditValue([{ label: 'x', selected: true }])).toBe('[updated]');
    expect(formatAuditValue({ a: 1 })).toBe('[updated]');
  });
});

describe('parseAuditDiff', () => {
  it('accepts a {field:{old,new}} object', () => {
    const diff = parseAuditDiff({ readiness_status: { old: 'Partial', new: 'Met' } });
    expect(diff).toEqual({ readiness_status: { old: 'Partial', new: 'Met' } });
  });

  it('rejects non-diff shapes and empties', () => {
    expect(parseAuditDiff(null)).toBeNull();
    expect(parseAuditDiff('nope')).toBeNull();
    expect(parseAuditDiff([1, 2])).toBeNull();
    expect(parseAuditDiff({})).toBeNull();
    expect(parseAuditDiff({ x: { old: 1 } })).toBeNull(); // missing `new`
  });
});

describe('auditDiffLines', () => {
  it('renders an update as "old → new" with a humanized label', () => {
    const lines = auditDiffLines({ readiness_status: { old: 'Partial', new: 'Met' } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ label: 'Readiness status', old: 'Partial', new: 'Met', created: false });
  });

  it('flags create lines (old === null) so the screen omits the arrow', () => {
    const lines = auditDiffLines({ ssp_status: { old: null, new: 'Complete' } });
    expect(lines[0]).toMatchObject({ label: 'SSP status', new: 'Complete', created: true });
  });

  it('passes through the long-text marker the trigger stores', () => {
    const lines = auditDiffLines({ consultant_notes: { old: '[text changed]', new: '[text changed]' } });
    expect(lines[0]).toMatchObject({ label: 'Consultant notes', old: '[text changed]', new: '[text changed]' });
  });
});

describe('formatAuditTimestamp', () => {
  it('formats an ISO timestamp as YYYY-MM-DD HH:mm', () => {
    expect(formatAuditTimestamp('2026-06-12T09:15:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('returns the input unchanged when it is not a valid date', () => {
    expect(formatAuditTimestamp('not-a-date')).toBe('not-a-date');
  });
});

describe('auditRowToEntry', () => {
  const baseRow: AuditEventRow = {
    id: 'a1',
    created_at: '2026-06-12T09:15:00.000Z',
    action: 'assessment.updated',
    entity_type: 'client_control_assessments',
    entity_id: 'e1',
    client_id: 'c1',
    user_id: 'u1',
    actor_name: 'Dana',
    new_value: { readiness_status: { old: 'Partial', new: 'Met' } },
  };

  it('normalizes a row + resolved client name into a display entry', () => {
    const entry = auditRowToEntry(baseRow, 'Acme Defense');
    expect(entry).toMatchObject({
      id: 'a1',
      actorName: 'Dana',
      clientId: 'c1',
      clientName: 'Acme Defense',
      action: 'assessment.updated',
      details: null,
    });
    expect(entry.diff).toEqual({ readiness_status: { old: 'Partial', new: 'Met' } });
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('falls back to "system" when actor_name is null', () => {
    const entry = auditRowToEntry({ ...baseRow, actor_name: null }, null);
    expect(entry.actorName).toBe('system');
    expect(entry.clientName).toBeNull();
  });

  it('leaves diff null for events without a structured diff', () => {
    const entry = auditRowToEntry({ ...baseRow, action: 'auth.signed_in', new_value: null }, null);
    expect(entry.diff).toBeNull();
  });
});
