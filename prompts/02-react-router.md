# Task 02 — Real routing (React Router, client-scoped URLs)

> Repo-wide rules live in CLAUDE.md and apply on top of everything below.

TASK: Replace the custom ?screen= router in src/App.tsx with react-router-dom v6
using proper URL paths, WITHOUT changing any screen's visual output.

AUTHORIZED NEW DEPENDENCY: react-router-dom@6 only.

CURRENT STATE: src/App.tsx maps a ScreenKey (src/types.ts) to screen components
from src/screens/, syncs it to the ?screen= query param and localStorage
(bf_screen), and provides keyboard nav ([ / ] to step, g for the screen index).
Shell.tsx renders sidebar/topnav navigation that sets the screen key.

REQUIRED ROUTE STRUCTURE (design for multi-client from day one):
  /login
  /dashboard                          (internal Benchmark Fox dashboard)
  /clients                            (clients list)
  /clients/new                        (create client)
  /clients/:clientId                  (client dashboard)
  /clients/:clientId/intake
  /clients/:clientId/path
  /clients/:clientId/scope
  /clients/:clientId/controls         (control matrix)
  /clients/:clientId/controls/:controlId   (control detail)
  /clients/:clientId/ssp
  /clients/:clientId/poam
  /clients/:clientId/evidence
  /clients/:clientId/tasks
  /clients/:clientId/reports
  /clients/:clientId/reports/preview
  /library                            (control library, client-agnostic)
  /knowledge
  /audit
  /settings
  /mobile

IMPLEMENTATION REQUIREMENTS
1. Create src/routes.tsx defining the route tree with a layout route that
   renders Shell. Screens render via <Outlet/> context or element props — keep
   screen components themselves unchanged where possible; write thin route
   wrapper components that read :clientId / :controlId params and pass them
   down. For now :clientId resolves against the existing seed clients
   (CURRENT_CLIENT_ID remains the default — redirect /clients/unknown-id to
   /clients).
2. Backward compatibility: a redirect component that maps legacy ?screen=<key>
   URLs to the new paths (preserve the published demo links). Keep the mapping
   table in one file with a comment listing all 21 legacy keys.
3. Preserve ALL existing UX: keyboard [ / ] stepping (now navigates between
   routes in the same order), g opens the screen index (now navigates by route),
   the Tweaks panel, and the selected-control flow (Control Matrix row click →
   /clients/:clientId/controls/:controlId, with bf_selected_control kept in sync
   for now so other screens don't break).
4. Use a NotFound route that offers a link back to /dashboard.
5. Update the Playwright smoke tests from Prompt 1 to use real paths, and add a
   test that a legacy ?screen=controls URL redirects correctly.
6. Document the route map in README.md, replacing the screen-key table's
   navigation instructions (keep the table, add a Route column).

DO NOT
- Restyle anything. Pixel-identical screens.
- Introduce data fetching, auth, or guards yet (that's a later task) — but DO
  leave a clearly marked <ProtectedRoute> placeholder component (currently a
  pass-through) wrapping everything except /login, so auth can slot in later.

ACCEPTANCE: typecheck/build/test/e2e green; manually clicking through all 21
screens works; deep-linking any new URL cold-loads the right screen; legacy
?screen= links redirect.
