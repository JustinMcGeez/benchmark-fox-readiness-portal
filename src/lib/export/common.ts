/* ============================================================================
   Shared export constants + helpers — the single home for branding, the
   readiness-support disclaimer, the methodology citation, and the filename
   convention used by ALL THREE client-side deliverables (SSP .docx, POA&M
   .xlsx, SPRS readiness .pdf).

   Hex colors are stored WITHOUT the leading '#': docx + exceljs want bare
   ARGB/RGB hex; consumers that need a CSS '#RRGGBB' prefix it themselves.
   ============================================================================ */
import { READINESS_SUPPORT_DISCLAIMER } from '../../data/disclaimers';

/* ---- palette (matches the wireframe tokens: navy #0a2348, silver #7e8691) ---- */
export const NAVY = '0A2348';
export const SILVER = '7E8691';
export const RED = 'C0392B';
export const WHITE = 'FFFFFF';

/** Re-exported so exporters import all branding/legal text from one module. */
export { READINESS_SUPPORT_DISCLAIMER };

/** Official scoring methodology citation — verbatim, reused by the SSP + the PDF. */
export const DOD_AM_CITATION =
  'NIST SP 800-171 DoD Assessment Methodology, Version 1.2.1 (Annex A)';

/** Standing CONFIDENTIAL marking used in deliverable footers. */
export const CONFIDENTIAL_LABEL = 'CONFIDENTIAL';

/** Sanitize a name into a filename-safe slug (collapses non-alphanumerics to '_'). */
export function exportSlug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'Client';
}

/** Locale-independent YYYY-MM-DD stamp (stable across machines + tests). */
export function exportDateStamp(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "June 13, 2026" — locale-independent so tests + document output stay stable. */
export function formatLongDate(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Canonical deliverable filename: `{clientSlug}_{deliverable}_{YYYY-MM-DD}.{ext}`.
 * e.g. exportFilename('Acme Defense', 'POAM', 'xlsx') →
 *      'Acme_Defense_POAM_2026-06-13.xlsx'.
 */
export function exportFilename(
  clientName: string,
  deliverable: string,
  ext: string,
  date: Date = new Date(),
): string {
  return `${exportSlug(clientName)}_${deliverable}_${exportDateStamp(date)}.${ext}`;
}
