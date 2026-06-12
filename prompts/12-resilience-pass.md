# Task 12 — Error handling, monitoring, and resilience pass

> Repo-wide rules live in CLAUDE.md and apply on top of everything below.

TASK: Production resilience sweep. No new features.

AUTHORIZED NEW DEPENDENCY: @sentry/react (init gated behind VITE_SENTRY_DSN —
absent in Local Prototype mode, app must run identically without it).

1. React error boundaries: a top-level boundary (branded "Something went wrong"
   panel with Reload + copyable error id) and per-screen boundaries so one
   screen crashing doesn't take down the shell.
2. Sentry: errors + unhandled rejections only (no session replay, no
   performance tracing for now). SCRUB before send: strip emails, client names,
   anything from intake/scope free-text — implement beforeSend that allowlists
   error name/message/stack and drops everything else. Document this in the
   README privacy section.
3. Repository layer: wrap Supabase errors into the typed RepositoryError with
   user-safe messages; add retry-with-backoff (3 attempts, jitter) for reads
   only — NEVER auto-retry writes (duplicate-write risk); writes surface a
   Retry button instead.
4. Offline/spotty network: a connectivity banner ("Reconnecting — changes will
   retry"), TanStack Query online manager wired, mutations paused while offline.
5. Empty states: every list screen gets a designed empty state (icon + one line
   + primary action) — controls matrix with no client selected, evidence with
   no items, new client dashboard. Use existing primitives.
6. Accessibility pass: keyboard focus visible on all interactive elements,
   inline-edit dropdowns reachable by keyboard, aria-labels on icon-only
   buttons, color-contrast check on the status badges (fix any failing AA —
   adjust the tinted status tokens in wireframe.css minimally, list changes).
7. Tests: error boundary unit tests; a Playwright test that blocks network
   (route abort) mid-session and asserts the banner + no crash.

ACCEPTANCE: killing the network mid-edit produces a graceful retry path; a
thrown render error in one screen leaves nav functional; Sentry receives
scrubbed events in a test project.
