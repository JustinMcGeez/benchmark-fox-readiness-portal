# Task 07 — Real client CRUD + assignments + client switching

> Repo-wide rules live in CLAUDE.md and apply on top of everything below.

TASK: Make the app genuinely multi-client. Today there is one hardcoded
CURRENT_CLIENT_ID (src/data/clients.ts) and the Create Client screen is a mock.

1. Repository expansion: extend the ClientDataRepository pattern (Prompt 4) with
   a ClientsRepository: listClients(), getClient(id), createClient(input),
   updateClient(id, patch), archiveClient(id) (status → Closed; NEVER hard
   delete — engagements are records), plus assignment methods:
   listAssignments(clientId), assignConsultant(clientId, profileId),
   removeAssignment(...). Local + Supabase implementations as before.
2. Create Client screen → a real multi-step form using the existing intake-style
   UI: org basics (name, CAGE code optional, DIB role prime/sub, contract types
   FAR/DFARS), target CMMC level (L1/L2/Undetermined), primary contact, and
   initial consultant assignment (admins only). Validate: name required and
   unique-ish (warn on near-duplicate), email format. On create: insert client,
   create the 110 assessment rows for that client with status 'Not Reviewed'
   (batch insert in one call — do NOT loop 110 inserts), write audit event,
   navigate to /clients/:newId.
3. Client switching: clients list rows + a client switcher in Shell's client
   tabs navigate to /clients/:clientId/...; ALL screens under /clients/:clientId
   must read clientId from the route (kill every remaining import of
   CURRENT_CLIENT_ID from screens — grep and list each one you remove). The
   clients list computes live readiness/SPRS per client from its real
   assessments (reuse lib/scoring.ts); clients with no reviewed controls show
   'Not started' (this pattern already exists for seed data — preserve it).
4. Permissions in UI: creation/archival visible to benchmark_fox_admin only;
   consultants see only assigned clients in the list (RLS already enforces it —
   the UI just shouldn't render dead buttons). Use the RequireRole component.
5. Local Prototype mode: clients CRUD works against localStorage (bf_clients_v1)
   so demos can show the flow.
6. Tests: unit tests for createClient seeding exactly 110 assessment rows and
   for archive-not-delete; Playwright (local mode): create a client through the
   wizard, land on its empty dashboard, edit one control, see readiness move.

ACCEPTANCE: two clients can be worked independently with zero data bleed
(verify in the RLS suite with a new cross-client test on the new endpoints);
no screen references CURRENT_CLIENT_ID anymore.
