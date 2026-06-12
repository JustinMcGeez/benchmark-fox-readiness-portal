# Task 11 — Client portal (role-scoped views)

> Repo-wide rules live in CLAUDE.md and apply on top of everything below.

TASK: Let client users (client_executive, client_it_owner, evidence_uploader,
readonly_viewer) log in safely and see ONLY their engagement, in a simplified
portal experience. RLS (Prompt 5) is the hard boundary; this task is the UX
layer on top.

1. Portal shell: when the signed-in role is a client role, Shell renders a
   reduced nav: Dashboard, Controls (read-only matrix), Evidence (their tasks),
   Documents/Reports, Knowledge. No clients list, no audit, no settings, no
   internal dashboard, no Tweaks panel. Route guard: client roles hitting an
   internal route → redirect to their client dashboard (their clientId comes
   from their assignment — resolve it once in AuthProvider).
2. Client dashboard variant: readiness %, estimated SPRS with the disclaimer,
   by-family chart, their open evidence requests, upcoming milestones. HIDE
   internal-only data: consultantNotes, internal POA&M class items, internal
   task assignments. Centralize the "internal-only fields" list in one constant
   and enforce it in the Supabase layer too (column-restricted SELECT via a
   view or explicit column lists in the repository — RLS rows + restricted
   columns; explain your approach), so hiding is not purely client-side.
3. evidence_uploader experience: a focused queue of Requested / Needs Revision
   items with the link-submission drawer from Prompt 8; cannot see review
   controls.
4. readonly_viewer: everything view-only; every edit affordance hidden (not
   merely disabled).
5. Visual: same design system, but add a subtle "Client Portal" badge in the
   header and the client's name prominent, so screenshots are unambiguous.
6. Tests: unit tests for nav filtering per role; RLS suite additions asserting
   client roles cannot SELECT internal-only columns (via the view) ; Playwright
   (local mode with a role switcher in the Tweaks panel for demo purposes —
   gate that switcher to Local Prototype mode ONLY).

ACCEPTANCE: a client_executive session can see their readiness and nothing
internal; attempting internal routes/data fails server-side, not just in UI.
