/* ============================================================
   ErrorBoundary — branded crash containment.

   Two variants:
     - 'app'    : the top-level boundary (in main.tsx). A full-screen branded
                  "Something went wrong" panel with Reload + a copyable error id.
                  Catches anything the per-screen boundaries don't.
     - 'screen' : wraps the routed screen INSIDE the shell (routes.tsx), so one
                  screen crashing leaves the navigation, header, and the rest of
                  the chrome fully usable. Auto-clears when the route changes
                  (resetKey) and offers a "Try again" / "Go to Dashboard".

   Every caught error is reported to monitoring (Sentry, when configured) with a
   short error id the user can quote to support; the id is also tagged on the
   captured event (see src/lib/monitoring.ts scrubEvent).
   ============================================================ */
import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { captureError } from '../lib/monitoring';

/** Short, human-quotable id; also tagged on the captured Sentry event. */
function newErrorId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  } catch {
    return Math.random().toString(16).slice(2, 10).toUpperCase();
  }
}

interface ErrorBoundaryProps {
  children: ReactNode;
  variant: 'app' | 'screen';
  /** When this changes while an error is shown, the boundary clears (e.g. the
      route changed), so navigating away from a crashed screen recovers it. */
  resetKey?: unknown;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, errorId: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const errorId = newErrorId();
    captureError(error, { errorId });
    // componentStack is component names only (no client data) — safe to log in dev.
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', errorId, error, info.componentStack);
    }
    this.setState({ errorId });
  }

  componentDidUpdate(prev: ErrorBoundaryProps): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState({ error: null, errorId: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorFallback variant={this.props.variant} errorId={this.state.errorId} onReset={this.reset} />
      );
    }
    return this.props.children;
  }
}

/* ---- presentational fallback (kept dependency-light; usable above the router) ---- */

function CopyableErrorId({ id }: { id: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!id) return null;
  const copy = () => {
    void navigator.clipboard
      ?.writeText(id)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        /* clipboard may be unavailable — the id stays visible to copy by hand */
      });
  };
  return (
    <div
      className="center"
      style={{ gap: 8, justifyContent: 'center', fontSize: '.82rem', flexWrap: 'wrap' }}
    >
      <span className="w-label" style={{ margin: 0 }}>
        Error ID
      </span>
      <code
        className="mono"
        data-testid="error-id"
        style={{
          background: 'var(--fill)',
          borderRadius: 'var(--r-xs)',
          padding: '2px 8px',
          color: 'var(--ink)',
        }}
      >
        {id}
      </code>
      <button className="w-btn sm" onClick={copy} aria-label="Copy error ID">
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function ErrorFallback({
  variant,
  errorId,
  onReset,
}: {
  variant: 'app' | 'screen';
  errorId: string | null;
  onReset: () => void;
}) {
  const heading = variant === 'app' ? 'Something went wrong' : 'This screen ran into a problem';
  const message =
    variant === 'app'
      ? 'The Readiness Portal hit an unexpected error. Your saved data is safe. Reload to continue, and share the error id below if you contact support.'
      : 'The rest of the portal still works — use the navigation to move on, or try this screen again. Share the error id below if you contact support.';

  return (
    <div
      role="alert"
      className="center"
      style={{
        minHeight: variant === 'app' ? '100vh' : '50vh',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="w-card col"
        style={{ maxWidth: 520, width: '100%', padding: 28, gap: 14, textAlign: 'center' }}
      >
        {variant === 'app' && (
          <span
            className="w-eyebrow"
            style={{ color: 'var(--navy-500)', letterSpacing: '.14em' }}
          >
            Benchmark Fox Readiness Portal
          </span>
        )}
        <h1 className="w-h1" style={{ fontSize: variant === 'app' ? '1.7rem' : '1.3rem' }}>
          {heading}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {message}
        </p>
        <CopyableErrorId id={errorId} />
        <div className="row gap-sm" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          {variant === 'app' ? (
            <button className="w-btn primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          ) : (
            <>
              <button className="w-btn primary" onClick={onReset}>
                Try again
              </button>
              <a className="w-btn" href="/dashboard" style={{ textDecoration: 'none' }}>
                Go to Dashboard
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
