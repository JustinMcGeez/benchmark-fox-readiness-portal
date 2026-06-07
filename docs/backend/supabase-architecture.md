# Benchmark Fox Readiness Portal — Supabase / Postgres Backend Architecture

> **Status:** Schema planned and committed. The frontend still runs entirely on
> the TypeScript seed data + `localStorage` (see `src/data/store.ts`). This phase
> is **additive and non-breaking** — nothing here is wired into the running app
> yet. It establishes the backend foundation that will later replace
> `localStorage` and seed data.

---

## 1. Why Supabase / Postgres

Supabase is the chosen backend for the MVP and near-term production build:

- **Postgres is the right data model.** The domain is deeply relational —
  clients ↔ assessments ↔ controls ↔ evidence ↔ POA&Ms ↔ tasks ↔ audit events.
  A relational store with foreign keys, unique constraints, and transactions
  matches this far better than a document store.
- **Row Level Security (RLS).** Benchmark Fox manages **multiple clients** and
  will later expose a **client portal**. Postgres RLS lets us enforce
  "no cross-client data leakage" at the database layer, not just in app code —
  the single most important security property for a multi-tenant compliance tool.
- **Auth built in.** Supabase Auth (GoTrue) gives us users, sessions, JWTs, and
  email/SSO without standing up our own identity service. `auth.uid()` is
  directly usable inside RLS policies.
- **Managed Postgres + migrations + generated types.** We get point-in-time
  backups, a migration workflow (`supabase/migrations/`), and
  `supabase gen types typescript` to keep `src/lib/database.types.ts` in sync
  with the schema — end-to-end type safety from DB to React.
- **Clean seam already exists.** `src/data/store.ts` is documented as
  "the seam where Supabase/Postgres would slot in." The domain interfaces in
  `src/data/types.ts` are already the contract this schema mirrors.

## 2. What data will be stored

The MVP backend stores **readiness metadata and workflow state** only:

- Organizations (Benchmark Fox + future tenants) and clients (engagements).
- Users / profiles, roles, and client assignments (who works which engagement).
- The control library: control families, the 110 NIST SP 800-171 Rev. 2
  controls, source references, and the control↔source mapping.
- Per-client control assessments (readiness/SSP/evidence/POA&M status, risk,
  owner, due date, notes, validation method, review metadata).
- Intake records, scope records, and scope assets.
- **Evidence metadata and approved secure external links only** (see §7).
- POA&M items (weaknesses, milestones, remediation metadata).
- Tasks (remediation work items).
- Reports (report **metadata** — title, type, generated-at, parameters — not the
  rendered CUI-bearing artifact).
- Audit events (accountability trail).

## 3. What data must NOT be stored during MVP

> **MVP data-sensitivity rule — hard constraint.**

The MVP database **must not** store:

- **CUI** (Controlled Unclassified Information) of any kind.
- **Real sensitive client evidence files** — screenshots, configs, exports,
  policies, logs, or any artifact that could itself contain CUI/FCI.
- Rendered report **files** that embed client-sensitive content.
- Secrets / credentials for client systems.

Instead we store **metadata** describing those artifacts and **approved secure
external links** to where the artifact actually lives (the client's own GCC High
/ SharePoint / secure store). The portal points at evidence; it does not hold it.

Rationale: storing CUI brings the application itself into CMMC/DFARS assessment
scope and creates handling, residency, and breach-liability obligations that an
MVP must not assume. Keeping the portal **metadata-only** keeps it out of CUI
scope while still delivering the readiness-tracking value.

## 4. App security assumptions (MVP)

- **Internal-only login.** For the MVP, **only Benchmark Fox internal users**
  (admins and consultants) authenticate and use the app.
- **Supabase Auth** is the identity provider; every `profiles` row is keyed to an
  `auth.users` id.
- **RLS is the enforcement boundary.** All access rules live in Postgres
  policies, so a compromised or buggy frontend cannot read another client's data.
- **The `anon` key is public** (shipped to the browser). It grants nothing on its
  own — RLS denies all unauthenticated access to tenant tables. The
  `service_role` key is **server-only** and must never reach the client bundle.
- **Soft delete, not hard delete**, for client-facing records — so an accidental
  delete is recoverable and the audit trail stays intact.
- **No CUI at rest** (see §3), which deliberately limits breach blast radius.

## 5. Internal-only MVP model

```
Benchmark Fox organization
        │
        ├── benchmark_fox_admin        (sees all clients)
        └── benchmark_fox_consultant   (sees only assigned clients)
                    │
                    └── client_assignments ── client (engagement)
                                                  │
                                                  ├── client_control_assessments
                                                  ├── intake_records / scope_records / scope_assets
                                                  ├── evidence_items (metadata + links only)
                                                  ├── poam_items
                                                  ├── tasks
                                                  ├── reports (metadata)
                                                  └── audit_events
```

The control **library** (`control_families`, `controls`, `source_references`,
`control_source_references`) is **global reference data** shared across all
clients — it is readable by any authenticated Benchmark Fox user and writable
only by admins / the data pipeline.

## 6. Future client portal considerations

The schema is designed now so the client portal can be added **without a
migration of the access model**:

- Roles already include `client_executive`, `client_it_owner`,
  `evidence_uploader`, and `readonly_viewer`.
- `client_assignments` already maps a `profile` to a `client` with a role, so a
  client user is "just another assignment" scoped to a single client.
- RLS policies are written in terms of "is this profile assigned to this
  client?" — the same predicate serves consultants today and client users later.
- Client users will be **read-mostly**; `evidence_uploader` is the one
  write-capable external role, and only for evidence **metadata/links**.

When the portal ships, we flip RLS from "Benchmark Fox staff only" to also
include client assignments — no table restructuring required.

## 7. Evidence metadata / link-only approach

`evidence_items` is intentionally a **metadata table**. It has **no file column,
no bytea, no base64 blob**. It records:

- what the evidence is (`title`, `evidence_type`, `evidence_date`),
- its review lifecycle (`status`, `quality`, `freshness_status`, `reviewed_by`,
  `reviewed_at`),
- where it actually lives (`external_link`, `storage_location_note`),
- and how it relates to the rest of the model (`control_id`, `supports_ssp`,
  `related_poam_id`, `related_task_id`).

A SQL comment in the migration restates the rule directly on the table. If/when
real file storage is introduced, it will go through a **dedicated, scoped, and
explicitly CUI-authorized** Supabase Storage bucket — a separate decision with
its own security review, **not** this MVP table.

## 8. Migration strategy from localStorage to Supabase

The migration is **incremental and reversible**, behind the existing
`src/data/store.ts` seam:

1. **Phase 0 (this phase).** Schema, RLS plan, env example, Supabase client
   placeholder, and types stub land in the repo. **No runtime behavior changes** —
   `store.ts` still reads/writes `localStorage`.
2. **Phase 1 — seed the database.** Push migrations to a Supabase project and
   load the global reference data (control families, 110 controls, source refs)
   from the same generator that produces `controls.generated.ts`.
3. **Phase 2 — read path.** Add a Supabase-backed implementation behind the
   `useData()` interface. Gate it with an env flag so the app can run on either
   `localStorage` or Supabase. Reads first, writes still local.
4. **Phase 3 — write path + auth.** Turn on Supabase Auth (internal users),
   move assessment/intake/scope/evidence/POA&M/task writes to the database, and
   start emitting `audit_events`.
5. **Phase 4 — retire localStorage** for shared data (keep it only for UI
   preferences like tweaks). Provide a one-time importer for any local edits.
6. **Phase 5 — client portal.** Extend RLS + assignments for external roles.

Because `useData()` is the only thing screens depend on, each phase swaps the
implementation, not the screens.

## 8a. Local development, seeding & validation

This proves the migration runs and loads **global reference data only** — it
does not wire the frontend, add auth, or store any client/CUI data.

**Install the Supabase CLI** (any one): `npm install -D supabase` (then
`npx supabase …`), `scoop install supabase`, or `brew install supabase/tap/supabase`.
The local stack requires **Docker Desktop** running.

**Run a local stack, apply migrations, reset:**

```bash
npx supabase start          # Postgres + Studio + Auth; prints local URL + keys
npx supabase db reset       # re-runs ALL migrations, then supabase/seed.sql
                            # (destructive — LOCAL ONLY; never against production)
```

`supabase/seed.sql` runs automatically on `db reset` and seeds the small, stable
pieces (the Benchmark Fox org + the 14 families) plus the `tenant_rls_status()`
helper used by validation.

**Seed the remaining reference data** (110 controls, source registry, mapping),
which is generated from the app's TypeScript so it always matches the library:

```bash
# Use the LOCAL service_role key from `supabase status` (server-only secret):
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_SERVICE_ROLE_KEY=<local service_role key>
npm run db:seed:refs        # scripts/seed-supabase-reference-data.ts (idempotent)
npm run db:validate         # scripts/validate-supabase-schema.mjs
```

**Seeding is idempotent** — every write is an upsert on a stable unique key:
`organizations.slug`, `control_families.code`, `controls.natural_id`,
`source_references.source_id`, and `(control_id, source_id)`. Re-running never
duplicates rows.

**`db:validate` checks:** 14 families, 110 controls, no duplicate `natural_id`,
every control has ≥1 source reference, every control has `score_source` set,
`score_value` is null only when `score_source = 'placeholder'`, source
references exist, and (best-effort) RLS is enabled on every tenant table.

**Generate types from the live local schema** after any migration:

```bash
npx supabase gen types typescript --local > src/lib/database.types.ts
```

**Secrets.** The `service_role` key bypasses RLS and is **server-only** — it is
read from the environment by the seed/validate scripts and must **never** be
committed, placed in a `VITE_` var, or shipped to the browser. Only
`.env.example` is tracked; real values live in gitignored `.env*` files.

> Reference data only: `db:seed:refs` never inserts clients, evidence, POA&Ms,
> tasks, reports, or any CUI. `evidence_items` / `reports` remain metadata +
> external links only (§3, §7).

## 9. Table overview

| Table | Purpose | Soft delete |
| --- | --- | --- |
| `organizations` | Benchmark Fox + future tenant orgs | no |
| `clients` | Engagements managed by Benchmark Fox | **yes** |
| `profiles` | App users (1:1 with `auth.users`) | no (status flag) |
| `user_roles` | Role(s) granted to a profile | no |
| `client_assignments` | Which profile works which client, in what role | no |
| `control_families` | The 14 NIST 800-171 families (reference) | no |
| `controls` | The 110 NIST 800-171 Rev. 2 controls (reference) | no |
| `source_references` | Official + BF source-document registry (reference) | no |
| `control_source_references` | control ↔ source mapping (reference) | no |
| `client_control_assessments` | Per-client control status (unique client+control) | no |
| `intake_records` | Guided intake summary per client | **yes** |
| `scope_records` | Scoping summary per client | **yes** |
| `scope_assets` | Asset inventory under a scope record | **yes** |
| `evidence_items` | Evidence **metadata + secure links only** | **yes** |
| `poam_items` | POA&M weaknesses + milestones | **yes** |
| `tasks` | Remediation work items | **yes** |
| `reports` | Report **metadata** (not the artifact) | **yes** |
| `audit_events` | Accountability trail | no (append-only) |

## 10. Relationship overview

- `organizations 1—* clients`
- `organizations 1—* profiles` (a profile's home org)
- `profiles 1—1 auth.users`
- `profiles *—* clients` **through** `client_assignments` (with a role +
  primary/secondary flag)
- `profiles *—* roles` **through** `user_roles`
- `control_families 1—* controls`
- `controls *—* source_references` **through** `control_source_references`
- `clients 1—* client_control_assessments` and `controls 1—* client_control_assessments`
  (**unique** on `client_id + control_id`)
- `clients 1—* intake_records | scope_records | evidence_items | poam_items | tasks | reports`
- `scope_records 1—* scope_assets`
- `controls 1—* evidence_items | poam_items` (a control a piece of evidence / a
  POA&M relates to)
- `evidence_items *—1 poam_items` and `*—1 tasks` (optional relationship links)
- `audit_events *—1 organizations | clients | profiles` (all nullable; an event
  may be org-level, client-level, or system-level)

## 11. Row Level Security plan

Full draft policies live in [`supabase/policies/rls_plan.sql`](../../supabase/policies/rls_plan.sql).
Summary of intent:

- **RLS is enabled on every tenant table.** Reference tables
  (`control_families`, `controls`, `source_references`,
  `control_source_references`) are readable by any authenticated user and
  writable only by admins.
- **`benchmark_fox_admin`** — full access to all Benchmark Fox records.
- **`benchmark_fox_consultant`** — access limited to clients they are assigned to
  via `client_assignments`.
- **Client users (future)** — access limited to their single assigned client.
- **`evidence_uploader` (future)** — may create/read **evidence metadata** for
  assigned clients only; no edits to assessments/POA&Ms.
- **`readonly_viewer`** — may read assigned-client dashboards/reports; **no
  writes**.
- **No cross-client leakage** — every tenant table's policy is rooted in the
  `is_assigned_to_client()` / `is_bf_admin()` helper predicates, so a row is
  visible only if the caller's assignment (or admin status) allows it.

The plan deliberately keeps the helper predicates small and the policy set
realistic rather than exhaustive — it is a foundation to harden, not a finished
production policy set.

## 12. Audit logging plan

- Every mutating action (status change, evidence review, POA&M update, task
  change, assignment change) should write one `audit_events` row capturing
  **who, what, which entity, old value → new value, when**, plus `ip_address`
  and `user_agent`.
- `audit_events` is **append-only**: no UPDATE/DELETE policy is granted to
  application roles, and it is **not** soft-deletable.
- `old_value` / `new_value` are `JSONB` snapshots so the trail is
  schema-flexible and survives later column changes.
- Audit logging matters for **accountability and client trust**: a CMMC
  readiness engagement must be able to show *who changed a control's status and
  when*, and demonstrate that assessment data was handled responsibly.
- In Phase 3+, writes can be enforced with database triggers (defense in depth)
  in addition to app-level emission, so the trail cannot be bypassed by the app.

## 13. Known limitations

- **Not wired in.** This phase ships schema + scaffolding only; the running app
  still uses `localStorage`. No data is read from or written to Supabase yet.
- **RLS is a draft.** Policies are realistic but unhardened and untested against
  a live project; they need review and integration tests before production.
- **Types are a stub.** `src/lib/database.types.ts` is a hand-written placeholder
  until `supabase gen types typescript` is run against a real project (see the
  README backend section and the file header).
- **No official scoring / objectives yet.** `controls.score_value` mirrors the
  app's placeholder model; the DoD Assessment Methodology and 800-171A objectives
  are still not bundled.
- **Single active org/client in practice.** The multi-client model is designed
  but only exercised by one seeded engagement today.
- **Evidence files are explicitly out of scope** (see §3/§7); secure file
  storage is a separate, future, CUI-authorized decision.
