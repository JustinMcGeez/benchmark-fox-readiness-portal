/* ============================================================
   Evidence lifecycle — the SINGLE source of truth for the legal evidence
   state machine, role-gating, and the read-time expiry derivation (Task 08).

   METADATA ONLY: this module reasons about an evidence item's status, never
   its contents. There is no file storage anywhere in this product.

   The transition map below is the ONE place the legal moves are defined; the
   repository's transition() validates against it, the Evidence Hub renders only
   these next-status buttons, and migration 007's DB guard mirrors
   REVIEWER_ONLY_STATUSES as the server-side backstop.
   ============================================================ */
import type { EvidenceItem, EvidenceStatus } from '../data/types';

/**
 * Legal evidence transitions (Task 08). Exactly the rules in the task spec —
 * Missing and Rejected are terminal (no listed out-edges). Encoded once here;
 * nothing else hard-codes a move.
 */
export const EVIDENCE_TRANSITIONS: Record<EvidenceStatus, readonly EvidenceStatus[]> = {
  'Not Requested': ['Requested'],
  Requested: ['Uploaded', 'Missing'],
  Uploaded: ['In Review'],
  'In Review': ['Accepted', 'Needs Revision', 'Rejected'],
  'Needs Revision': ['Uploaded'],
  Accepted: ['Expired'],
  Expired: ['Requested'],
  Missing: [],
  Rejected: [],
};

/**
 * Statuses only Benchmark Fox staff (admin/consultant) may move evidence into.
 * The task spec names the review OUTCOMES (Accepted / Needs Revision / Rejected)
 * as consultant-only; we INTENTIONALLY also reserve 'In Review' — taking an item
 * into review is the reviewer claiming it, so an uploader/client should not be
 * able to drive the review pipeline state. This is a deliberate, slightly
 * stricter-than-spec posture (defense in depth), not an oversight.
 * evidence_uploader and client-role users are blocked from setting any of these
 * (enforced in the UI AND by migration 007's BEFORE INSERT/UPDATE guard). The DB
 * function is_reviewer_only_evidence_status() is kept in lockstep with this set.
 */
export const REVIEWER_ONLY_STATUSES: ReadonlySet<EvidenceStatus> = new Set<EvidenceStatus>([
  'In Review',
  'Accepted',
  'Needs Revision',
  'Rejected',
]);

export function isReviewerOnlyStatus(status: EvidenceStatus): boolean {
  return REVIEWER_ONLY_STATUSES.has(status);
}

/** The statuses an evidence item may legally move to from `from`. */
export function nextStatuses(from: EvidenceStatus): readonly EvidenceStatus[] {
  return EVIDENCE_TRANSITIONS[from] ?? [];
}

/** Is `from → to` a legal transition? */
export function canTransition(from: EvidenceStatus, to: EvidenceStatus): boolean {
  return nextStatuses(from).includes(to);
}

/**
 * Legal next statuses available to the acting user. Non-reviewers (evidence
 * uploaders / client roles) never see review-only targets, so the Evidence Hub
 * shows them only the moves they may actually perform.
 */
export function allowedNextStatuses(
  from: EvidenceStatus,
  canReview: boolean,
): readonly EvidenceStatus[] {
  const all = nextStatuses(from);
  return canReview ? all : all.filter((s) => !isReviewerOnlyStatus(s));
}

/** Typed error thrown for an illegal evidence transition. */
export class EvidenceTransitionError extends Error {
  readonly from: EvidenceStatus;
  readonly to: EvidenceStatus;

  constructor(from: EvidenceStatus, to: EvidenceStatus) {
    super(`Illegal evidence transition: ${from} → ${to}.`);
    this.name = 'EvidenceTransitionError';
    this.from = from;
    this.to = to;
  }
}

export function isEvidenceTransitionError(e: unknown): e is EvidenceTransitionError {
  return e instanceof EvidenceTransitionError;
}

/** Throw EvidenceTransitionError unless `from → to` is legal. */
export function assertTransition(from: EvidenceStatus, to: EvidenceStatus): void {
  if (!canTransition(from, to)) throw new EvidenceTransitionError(from, to);
}

/* ---- read-time expiry derivation (no cron; computed on every read) ---- */

/** Local-midnight of `d` (so an expiry date is "stale" only once it is past). */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Parse a YYYY-MM-DD (or ISO) expiry to a comparable local day, or null if
 * unset/invalid. A date-only string is read as a LOCAL calendar date (not UTC),
 * so the comparison against the local `now` never drifts by a day across
 * timezones.
 */
function expiryDay(expiresOn: string | undefined): number | null {
  if (!expiresOn) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(expiresOn.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const t = Date.parse(expiresOn);
  if (Number.isNaN(t)) return null;
  return startOfDay(new Date(t));
}

/**
 * Is this evidence past its expiry date? Only meaningful for Accepted evidence —
 * an item is "expired" when it was Accepted but its expiry date has passed.
 */
export function isExpired(item: Pick<EvidenceItem, 'status' | 'expiresOn'>, now: Date = new Date()): boolean {
  if (item.status !== 'Accepted') return false;
  const day = expiryDay(item.expiresOn);
  return day !== null && day < startOfDay(now);
}

/**
 * The status to DISPLAY: Accepted evidence past its expiry derives to 'Expired'
 * at read time. The stored status stays 'Accepted' until a consultant runs the
 * explicit Accepted → Expired transition (or re-requests it).
 */
export function effectiveStatus(
  item: Pick<EvidenceItem, 'status' | 'expiresOn'>,
  now: Date = new Date(),
): EvidenceStatus {
  return isExpired(item, now) ? 'Expired' : item.status;
}

/** Freshness to DISPLAY: derived from the expiry date when set, else the stored hint. */
export function effectiveFreshness(
  item: Pick<EvidenceItem, 'freshness' | 'expiresOn' | 'status'>,
  now: Date = new Date(),
): EvidenceItem['freshness'] {
  const day = expiryDay(item.expiresOn);
  if (day === null) return item.freshness ?? 'N/A';
  return day < startOfDay(now) ? 'Expired' : 'Current';
}
