/* ============================================================================
   auditLog.ts — PURE audit-log formatting + mapping (no Supabase, no React).

   The audit trail is captured server-side (DB triggers, migration 005) as a
   compact jsonb diff {field: {old, new}}. This module turns a raw audit_events
   row into a display-ready AuditLogEntry and humanizes the diff into lines like
   "Readiness status: Partial → Met". Kept side-effect-free so it is trivial to
   unit-test and is shared by both the repository (mapping) and the screen
   (rendering).
   ============================================================================ */
import type { Json } from './database.types';

/** A changed field's before/after, as stored in audit_events.new_value. */
export type AuditDiff = Record<string, { old: Json; new: Json }>;

/** One audit row, normalized for display by either runtime mode. */
export interface AuditLogEntry {
  id: string;
  /** Display-ready timestamp (already formatted; not a raw ISO string). */
  timestamp: string;
  actorName: string;
  /** Resolved client uuid (Supabase mode) — used as the client filter value. */
  clientId: string | null;
  clientName: string | null;
  /** Raw action key ('assessment.updated') or, in local mode, a freeform label. */
  action: string;
  /** Structured field diff, or null for create/auth events. */
  diff: AuditDiff | null;
  /** Freeform detail (local seed rows) shown when there is no structured diff. */
  details: string | null;
}

/** The subset of an audit_events row this module reads. */
export interface AuditEventRow {
  id: string;
  created_at: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  client_id: string | null;
  user_id: string | null;
  actor_name: string | null;
  new_value: Json | null;
}

/* ---- timestamps ---- */

/** Format an ISO timestamp as a compact, locale-stable audit label. */
export function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/* ---- action labels ---- */

const ACTION_LABELS: Record<string, string> = {
  'assessment.created': 'Assessment created',
  'assessment.updated': 'Assessment updated',
  'intake.created': 'Intake created',
  'intake.saved': 'Intake saved',
  'scope.created': 'Scope created',
  'scope.saved': 'Scope saved',
  'evidence.created': 'Evidence created',
  'evidence.updated': 'Evidence updated',
  'evidence.status_changed': 'Evidence status changed',
  'client.created': 'Client created',
  'auth.signed_in': 'Signed in',
  'auth.signed_out': 'Signed out',
};

/** "assessment.updated" -> "Assessment updated" (known) or a prettified fallback. */
export function humanizeAuditAction(action: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known;
  const pretty = action.replace(/[._]+/g, ' ').trim();
  return pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : action;
}

/* ---- field labels ---- */

const FIELD_LABELS: Record<string, string> = {
  // assessments
  readiness_status: 'Readiness status',
  implementation_status: 'Implementation status',
  ssp_status: 'SSP status',
  evidence_status: 'Evidence status',
  poam_status: 'POA&M status',
  risk_rating: 'Risk rating',
  owner_name: 'Owner',
  consultant_notes: 'Consultant notes',
  client_notes: 'Client notes',
  due_date: 'Due date',
  score_impact: 'Score impact',
  validation_method: 'Validation method',
  ssp_statement: 'SSP statement',
  // evidence
  status: 'Status',
  title: 'Title',
  evidence_type: 'Evidence type',
  quality: 'Quality',
  external_link: 'External link',
  storage_location_note: 'Storage location',
  freshness_status: 'Freshness',
  supports_ssp: 'Supports SSP',
  notes: 'Notes',
  // intake
  likely_cmmc_path: 'Likely CMMC path',
  estimated_scope: 'Estimated scope',
  likely_data_type: 'Likely data type',
  initial_risk_rating: 'Initial risk',
  recommended_next_step: 'Recommended next step',
  proposed_engagement: 'Proposed engagement',
  contract_clauses: 'Contract clauses',
  data_handling_types: 'Data handling',
  // scope
  assessment_boundary: 'Assessment boundary',
  cui_strategy: 'CUI strategy',
  msp_esp_involved: 'MSP/ESP involved',
  cloud_services: 'Cloud services',
  scope_notes: 'Scope notes',
};

/** DB column name -> human label (known) or a prettified fallback. */
export function formatFieldLabel(field: string): string {
  const known = FIELD_LABELS[field];
  if (known) return known;
  const pretty = field.replace(/_+/g, ' ').trim();
  return pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : field;
}

/** Render a single diff value for display. Containers are never expanded. */
export function formatAuditValue(value: Json): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.length === 0 ? '—' : value;
  // arrays / objects: don't dump raw JSON into the trail.
  return '[updated]';
}

/* ---- diff parsing + rendering ---- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate a raw new_value jsonb as an AuditDiff. Anything not shaped like
 * {field: {old, new}} yields null (rendered as a plain action, no arrows).
 */
export function parseAuditDiff(value: Json | null): AuditDiff | null {
  if (!isRecord(value)) return null;
  const out: AuditDiff = {};
  let count = 0;
  for (const [field, entry] of Object.entries(value)) {
    if (!isRecord(entry) || !('old' in entry) || !('new' in entry)) return null;
    out[field] = { old: (entry.old ?? null) as Json, new: (entry.new ?? null) as Json };
    count++;
  }
  return count > 0 ? out : null;
}

export interface AuditDiffLine {
  field: string;
  label: string;
  old: string;
  new: string;
  /** True when there is no prior value (a create event). */
  created: boolean;
}

/** Turn an AuditDiff into humanized lines for the Details column. */
export function auditDiffLines(diff: AuditDiff): AuditDiffLine[] {
  return Object.entries(diff).map(([field, { old, new: next }]) => ({
    field,
    label: formatFieldLabel(field),
    old: formatAuditValue(old),
    new: formatAuditValue(next),
    created: old === null,
  }));
}

/* ---- row -> entry ---- */

/** Map a raw audit_events row + resolved client name into a display entry. */
export function auditRowToEntry(row: AuditEventRow, clientName: string | null): AuditLogEntry {
  return {
    id: row.id,
    timestamp: formatAuditTimestamp(row.created_at),
    actorName: row.actor_name ?? 'system',
    clientId: row.client_id,
    clientName,
    action: row.action,
    diff: parseAuditDiff(row.new_value),
    details: null,
  };
}
