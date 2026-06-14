/* ============================================================================
   monitoring.ts — error + crash reporting (Sentry), privacy-first.

   Gated behind VITE_SENTRY_DSN: when it is absent (Local Prototype mode and any
   build without the var) NOTHING is initialized and the app behaves identically.
   Sentry is loaded LAZILY (dynamic import) only when a DSN is configured, so it
   never enters the main bundle in Local Prototype mode.

   What we send: ERRORS and UNHANDLED REJECTIONS only — no performance tracing,
   no session replay, no breadcrumbs. beforeSend (scrubEvent) is a strict
   ALLOWLIST: it keeps the error's type / message / stack-frame LOCATIONS and a
   few non-identifying envelope fields, and DROPS everything that could carry
   client data (request URL, user, contexts, extra, breadcrumbs, the top-level
   message). See the README "Error monitoring & privacy" section.
   ============================================================================ */
import type { ErrorEvent } from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();

/** True when a Sentry DSN is configured. Absent → monitoring is fully disabled. */
export const isMonitoringConfigured: boolean = Boolean(dsn);

/**
 * beforeSend scrubber — ALLOWLIST. Rebuilds the event keeping ONLY:
 *   - error type / message / stack-frame locations (file, function, line, col,
 *     in_app) — never local variables or source-context lines, and
 *   - a few non-identifying envelope fields (event id, timestamp, platform,
 *     level, environment, release, sdk) and our own `error_id` tag.
 * Everything else (request, user, contexts, extra, breadcrumbs, server name,
 * the top-level message) is discarded so no email / client name / intake or
 * scope free-text can ever leave the browser.
 *
 * Exported and pure so it can be unit-tested without initializing Sentry.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed: ErrorEvent = {
    type: event.type, // ErrorEvent discriminant (always undefined)
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    environment: event.environment,
    release: event.release,
    sdk: event.sdk,
  };

  if (event.exception?.values) {
    scrubbed.exception = {
      values: event.exception.values.map((value) => ({
        type: value.type,
        // The error message is intentionally kept (the task allowlists "error
        // name/message/stack"). This relies on app code NOT putting client data
        // in Error messages — RepositoryError messages are deliberately fixed,
        // user-safe strings (no SQL, table names, or row data).
        value: value.value,
        mechanism: value.mechanism,
        stacktrace: value.stacktrace
          ? {
              frames: (value.stacktrace.frames ?? []).map((frame) => ({
                filename: frame.filename,
                function: frame.function,
                lineno: frame.lineno,
                colno: frame.colno,
                in_app: frame.in_app,
              })),
            }
          : undefined,
      })),
    };
  }

  // Keep ONLY our generated error_id tag (a random id, never client data) so the
  // id shown in the UI can be matched to the captured event.
  if (event.tags && typeof event.tags.error_id === 'string') {
    scrubbed.tags = { error_id: event.tags.error_id };
  }

  return scrubbed;
}

/**
 * Initialize monitoring. No-op without a DSN. Best-effort: a failure to load or
 * initialize Sentry must never break app startup. Errors + unhandled rejections
 * only — no tracing, no replay, no breadcrumbs.
 */
export async function initMonitoring(): Promise<void> {
  if (!dsn) return;
  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Default integrations capture window.onerror + unhandledrejection. Strip
      // anything that adds tracing / replay / user feedback if present.
      integrations: (defaults) =>
        defaults.filter((integration) => !/Replay|BrowserTracing|Feedback/i.test(integration.name)),
      tracesSampleRate: 0,
      sendDefaultPii: false,
      // Drop ALL breadcrumbs — they can carry URLs (client ids), console output,
      // and fetch payloads. The scrubber drops them too; this is defense in depth.
      maxBreadcrumbs: 0,
      beforeBreadcrumb: () => null,
      beforeSend: (event) => scrubEvent(event),
    });
  } catch {
    // Monitoring is optional; swallow so a missing/blocked Sentry never crashes.
  }
}

/**
 * Report a caught error (e.g. from an error boundary). No-op without a DSN.
 * The optional errorId is attached as the only tag (matched in scrubEvent) so
 * the id a user copies from the crash screen maps to the captured event.
 */
export function captureError(error: unknown, context?: { errorId?: string }): void {
  if (!dsn) return;
  void import('@sentry/react')
    .then((Sentry) => {
      Sentry.captureException(
        error,
        context?.errorId ? { tags: { error_id: context.errorId } } : undefined,
      );
    })
    .catch(() => {
      // best-effort
    });
}
