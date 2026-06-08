# Benchmark Fox Readiness Portal

A polished, clickable prototype of the **Benchmark Fox Readiness Portal**, a
CMMC readiness command center. Built as a **Vite + React + TypeScript** app with
full **Benchmark Fox branding** — navy + silver palette, the BF fox monogram,
Montserrat/Inter typography, and crisp Lucide line icons.

## Run it

```bash
npm install
npm run dev               # start the dev server (opens http://localhost:5173)
npm run build             # type-check + production build to dist/
npm run preview           # preview the production build
npm run typecheck

# data pipeline
npm run import:sources    # regenerate src/data/generated/controls.generated.ts
npm run validate:controls # validate the generated 110-control library
npm run build:data        # import:sources + validate:controls
```

### Network / proxy

The committed `.npmrc` does **not** disable TLS verification. If you are behind a
corporate TLS-intercepting proxy and `npm install` fails with
`UNABLE_TO_VERIFY_LEAF_SIGNATURE`, fix it **locally** (don't commit it):

```bash
# Preferred — trust the proxy's root CA (export it from your OS trust store):
npm config set cafile "C:\\path\\to\\proxy-root-ca.pem"

# Or, as a last resort, relax verification only in your user config (not the repo):
npm config set strict-ssl false
```

`git` already works through the proxy because it uses the OS (SChannel) trust store.

## Navigating the wireframes

All **21 screens** are reachable in one app:

- **Screens** button (bottom-left) opens a grouped index — jump anywhere.
- Keyboard: `[` / `]` step through screens, `g` toggles the index.
- Click through naturally — sidebar nav, client tabs, table rows, and primary
  buttons all navigate.
- Deep-link any screen with `?screen=<key>` (e.g. `/?screen=controls`); the URL
  stays in sync as you navigate.
- **⚙ Tweaks** panel (bottom-right) toggles the **nav style**
  (sidebar / topnav / hybrid) and **spacing** density. Choices persist to
  `localStorage`.

### Screen map

| #  | Screen              | Key                |
|----|---------------------|--------------------|
| 01 | Login               | `login`            |
| 02 | Internal Dashboard  | `dashboard`        |
| 03 | Clients List        | `clients`          |
| 04 | Create Client       | `create-client`    |
| 05 | Client Dashboard    | `client-dashboard` |
| 06 | Guided Intake       | `intake`           |
| 07 | CMMC Path           | `path`             |
| 08 | Scoping Workspace   | `scope`            |
| 09 | Control Library     | `control-library`  |
| 10 | Control Matrix ★    | `controls`         |
| 11 | Control Detail      | `control-detail`   |
| 12 | SSP Workspace       | `ssp`              |
| 13 | POA&M Tracker       | `poam`             |
| 14 | Evidence Hub        | `evidence`         |
| 15 | Task Management     | `tasks`            |
| 16 | Reports             | `reports`          |
| 17 | Report Preview      | `report-preview`   |
| 18 | Knowledge Base      | `knowledge`        |
| 19 | Audit Log           | `audit`            |
| 20 | Settings            | `settings`         |
| 21 | Mobile Direction    | `mobile`           |

The **Client Dashboard** and **Control Matrix** are the heart of the platform.

## Branding

Brand assets live in `public/brand/`, cropped from the official Benchmark Fox
logo (`Assets/`):

- `mark-navy.png` / `mark-white.png` — the BF fox monogram (light/dark contexts)
- `logo-navy.png` / `logo-white.png` — full stacked logo with wordmark
- `favicon.png`

Palette: brand navy `#0a2348` (logo ≈ `#07224b`) and silver `#7e8691`, with cool
neutrals and tinted status colors. Type: **Montserrat** (headings), **Inter**
(body), **Roboto Mono** (data). Icons: **lucide-react**. All tokens live at the
top of `src/styles/wireframe.css`.

## Data-driven MVP

Every major screen is **computed from a structured data layer**, not hard-coded text.

```
src/
  data/
    types.ts                       # domain interfaces + enums (Client, Control,
                                   #   ClientControlAssessment, EvidenceItem, PoamItem, …)
    controlFamilies.ts             # the 14 NIST 800-171 families
    generated/controls.generated.ts# AUTO-GENERATED — all 110 NIST SP 800-171 Rev. 2 requirements
    controls.ts                    # generated library + Benchmark Fox overlay + seed assessments
    clients.ts                     # clients + audit log + users + CURRENT_CLIENT
    evidence.ts                    # evidence items (mapped to control/objective/SSP/POA&M/task)
    poam.ts                        # POA&M items (weakness, milestones, relationships)
    tasks.ts                       # remediation tasks
    reports.ts                     # report deliverables + what data feeds each
    knowledge.ts                   # knowledge-base articles
    intake.ts                      # guided-intake summary + CMMC path recommendation
    scope.ts                       # scoping summary + asset inventory
    sourceRefs.ts                  # official source-document registry (cited across the app)
    store.ts                       # <DataProvider> — seed merged with localStorage edits
  lib/
    scoring.ts                     # isolated scoring engine (readiness %, SPRS score, by-family)
    selectors.ts                   # shared derived counts (open POA&Ms, blockers, evidence, …)
data-sources/
    sp800-171r2.json               # LOCAL SOURCE — 110 official Rev. 2 requirement statements
scripts/
    import-sp800-171.ts            # regenerates generated/controls.generated.ts (run with: node scripts/import-sp800-171.ts)
```

- **Full 110-requirement library.** All NIST SP 800-171 Rev. 2 requirements are
  loaded with official requirement text, family, and CMMC level applicability.
- **Computed dashboards.** Client Dashboard / internal Dashboard / Report Preview
  derive readiness %, score, status counts, open POA&Ms, blockers, missing/weak
  evidence, top blockers, next actions, and by-family breakdowns via `lib/scoring.ts`.
- **Functional Control Matrix.** Real search + family/status/SSP/evidence filters,
  inline editable dropdowns (readiness/SSP/evidence/POA&M/owner) that **persist to
  `localStorage`** and flow to every screen. Clicking a row opens that control's
  **Control Detail**.
- **Source attribution everywhere.** Control Detail, SSP, POA&M, Evidence, and CMMC
  Path screens show a **Sources** strip citing the official documents behind the data.

### Official source documents

Content and data modeling are based **only** on official sources (see
`src/data/sourceRefs.ts`): NIST SP 800-171 Rev. 2 & 800-171A, the NIST SP 800-171
DoD Assessment Methodology, FAR 52.204-21, DFARS 252.204-7012/7019/7020,
32 CFR Part 170, the CMMC Level 1/2/3 scoping & assessment guides, the NARA CUI
Registry, and Benchmark Fox internal templates. Requirement text in
`data-sources/sp800-171r2.json` is reproduced verbatim from NIST SP 800-171 Rev. 2
(public-domain U.S. Government work).

### Local source file process

`data-sources/sp800-171r2.json` is the source of truth for the control library.
`scripts/import-sp800-171.ts` parses it into `src/data/generated/controls.generated.ts`,
and `scripts/validate-controls.mjs` checks the result (count = 110, 14 families, no
duplicates, required fields, `nist-sp-800-171r2` cited, `scoreSource` valid):

```bash
npm run build:data   # import:sources + validate:controls (Node 22.6+/24)
```

To import official data we don't bundle yet (e.g. a NIST CSV/XLSX or the DoD
Assessment Methodology scoring), drop the file in `data-sources/`, extend
`loadRequirements()`, and re-run — no screen changes required.

### What is data-driven vs. placeholder

| Area | State |
| --- | --- |
| 110 requirement texts, numbers, families, L1/L2 applicability | ✅ official (NIST 800-171 Rev. 2) |
| Readiness %, status counts, dashboards, matrix, detail, SSP/POA&M/Evidence/Tasks/Reports/Mobile | ✅ computed from data |
| Intake summary, CMMC path recommendation, scope summary + assets | ✅ data-driven **and editable** (`intake.ts` / `scope.ts`, persisted to localStorage) |
| SPRS deduction values (`scoreValue`, `scoreSource`) | ⚠️ **placeholder** (`scoreValue: null`, `scoreSource: 'placeholder'`) — DoD Assessment Methodology not bundled; UI shows a "scoring not finalized" warning |
| Assessment objectives (800-171A) | ⚠️ placeholder (not bundled) |
| Plain-English explanations / evidence examples / SSP & POA&M guidance | ✏️ Benchmark Fox-authored for a curated subset; the rest show TODO placeholders |

Scoring is isolated in `lib/scoring.ts` so the placeholder model (Met = 0
deduction, otherwise full; readiness gives Partial half credit) can be replaced
with official rules without touching any screen.

## App structure

```
src/
  main.tsx                 # React entry (wraps App in <DataProvider>)
  App.tsx                  # router, screen-index launcher, tweaks, ?screen= deep-link
  types.ts                 # app/nav types (ScreenKey, tones, tweak values…)
  styles/wireframe.css     # the design system (navy/silver brand tokens)
  components/
    primitives.tsx         # Btn, Field, Badge, Status, InlineSelect, charts, Card, …
    Shell.tsx              # app shell — sidebar / topnav / hybrid + client tabs
    Brand.tsx              # BrandMark / BrandLockup / BrandLogo (real logo assets)
    SourceBadge.tsx        # SourceBadge / Sources attribution UI
  tweaks/TweaksPanel.tsx   # floating tweaks panel + useTweaks (localStorage)
  screens/                 # core / client / controls / work / output + index barrel
```

## Clearing local data

Matrix/detail edits persist in `localStorage`. To reset to seed data:

- **In-app:** open the **⚙ Tweaks** panel (bottom-right) → **Developer → ↺ Reset
  demo data**. This clears the `bf_*` keys and reloads.
- **Manually:** clear the `bf_*` keys (`bf_assessments_v1`, `bf_intake_v1`,
  `bf_scope_v1`, `bf_selected_control`, `bf_screen`, `bf_tweaks`) in devtools →
  Application → Local Storage, or run `localStorage.clear()` in the console.

## Current MVP status

**At a glance**
- **All 110 controls loaded?** ✅ Yes — full NIST SP 800-171 Rev. 2 set.
- **All 14 families present?** ✅ Yes (AC, AT, AU, CM, IA, IR, MA, MP, PS, PE, RA, CA, SC, SI).
- **Scoring values official or placeholder?** ⚠️ Placeholder (`scoreValue: null`,
  `scoreSource: 'placeholder'`) — readiness % is real; SPRS score is flagged "not finalized".
- **Intake / Scope editable?** ✅ Yes — localStorage-backed, with auto-save and reset-to-seed.
- **Type-safe / builds?** ✅ `npm run typecheck` and `npm run build` pass.
- **Backend?** 🟡 **Planned, not wired.** Supabase/Postgres schema, RLS draft, and
  client scaffolding are committed (see **Backend** below); the app still runs on
  TypeScript seed + `localStorage`.

**Complete**
- All 110 NIST SP 800-171 Rev. 2 requirements loaded from a local source file via
  a reproducible generator; official requirement text + family + L1/L2.
- Every major screen is data-driven (no hard-coded client metrics in components):
  internal Dashboard, Clients, Client Dashboard, Control Matrix, Control Detail,
  SSP, POA&M, Evidence, Tasks, Reports, Report Preview, Audit, Knowledge,
  Settings, Mobile.
- Computed metrics (readiness %, status counts, by-family, open POA&Ms, blockers,
  missing/weak evidence, open tasks) centralized in `lib/scoring.ts` + `lib/selectors.ts`.
- Report Preview "Top Findings" are computed (`lib/selectors.ts` `topFindings`)
  from blocker POA&Ms, not-met/high-risk controls, SSP missing/needs-fix, and
  missing/weak evidence. SSP / POA&M / Evidence detail panels follow the selected
  row (no longer hard-pinned to 3.1.1 / first item).
- Control Matrix: search + filters + inline editable dropdowns persisted to
  `localStorage`; selecting a row opens that control's detail; refresh-safe.
- Source attribution (`sourceRefs.ts` + `SourceRefs.tsx`) on Control Detail, CMMC
  Path, SSP, POA&M, Evidence, and the Report Preview footer; every control carries
  ≥1 source reference.
- Disclaimers/warnings: readiness ≠ certification, scoring-not-finalized, CUI
  handling, POA&M reliance, path-not-legal-advice.
- Type-safe: `npm run typecheck` and `npm run build` pass (strict TS).

**Partially complete**
- Benchmark Fox plain-English explanations / evidence examples / SSP & POA&M
  guidance authored for a curated control subset; remaining controls show TODO
  placeholders.
- Worked client data covers one active engagement (Acme Defense); its Clients-list
  row computes live (readiness/score from assessments, labeled `live`). Clients
  without assessments show **"Seed summary only"** / **"Not started"** instead of
  fake computed scores.

**Placeholder**
- SPRS deduction values (`scoreValue = null`, `scoreSource = 'placeholder'`) pending
  the DoD Assessment Methodology — the SPRS-style score is flagged "scoring not
  finalized" everywhere.
- NIST SP 800-171A assessment objectives (not bundled).
- Intake / Path / Scope are seeded from `intake.ts` / `scope.ts` and are
  **editable with localStorage persistence** (summary fields, contract/data
  selections, scope assets) — auto-saved with reset-to-seed controls; prototype
  workflows, not yet backed by a database.

**Known limitations**
- No backend; single active client; auth is a prototype shell only.
- Intake/Path form option lists and Settings non-table panels remain inline mockups.
- Scoring model is a readiness heuristic, not the official methodology.

**Next recommended build phase**
1. Import official DoD Assessment Methodology scoring → flip `scoreValue` to real
   values and remove the "scoring not finalized" warning.
2. Import NIST SP 800-171A assessment objectives into the control library.
3. Introduce Supabase/Postgres behind `data/store.ts` (multi-client, real auth,
   evidence file storage) — the data interfaces are already the seam for this.

## Backend (Supabase / Postgres)

- **Backend target:** **Supabase / Postgres** (managed Postgres + Auth + Row
  Level Security).
- **Current status:** **Schema planned; frontend still on `localStorage`.** This
  phase is **additive and non-breaking** — the schema, RLS draft, env example,
  Supabase client placeholder, and type stub are committed, but **nothing reads
  from or writes to Supabase yet**. `src/data/store.ts` remains the seam where
  the backend will later slot in.
- **Full architecture:** see
  [`docs/backend/supabase-architecture.md`](docs/backend/supabase-architecture.md)
  (why Supabase, what is/ isn't stored, tenancy, roles, RLS, audit, migration
  plan, limitations).

```
docs/backend/supabase-architecture.md   # architecture + migration strategy
supabase/migrations/001_initial_schema.sql  # initial schema (18 tables, enums, RLS enabled)
supabase/policies/rls_plan.sql           # draft Row Level Security policies
supabase/seed.sql                        # auto-seed: org + 14 families + RLS-status helper
scripts/seed-supabase-reference-data.ts  # idempotent reference-data seeder (db:seed:refs)
scripts/validate-supabase-schema.mjs     # reference-data validator (db:validate)
src/lib/supabaseClient.ts                # typed client placeholder (warns if unconfigured)
src/lib/database.types.ts                # type STUB (regenerate with Supabase CLI)
.env.example                             # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
```

### Data sensitivity rule (MVP — hard constraint)

> **Do NOT store CUI or real sensitive client evidence files in this app during
> the MVP.** The database holds **readiness/control/SSP/POA&M/task/report
> metadata, audit logs, and evidence metadata + approved secure external links
> only**. `evidence_items` has **no file column by design** — the artifact stays
> in the client's own secure store and is referenced by `external_link`. See the
> warning at the top of the migration and the architecture doc §3/§7.

### Set environment variables

```bash
cp .env.example .env.local        # then fill in real values (never commit them)
# .env / .env.* are gitignored; only .env.example is tracked.
```

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>     # public; access is enforced by RLS
```

The anon key is **public** and safe to ship in the browser bundle — Postgres RLS
is the access boundary. **Never** put the `service_role` key in a `VITE_` var or
the client bundle. If both vars are unset, the app simply continues on
`localStorage` (the client warns once and disables backend calls).

### Run migrations later

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push                 # apply supabase/migrations/* to the project
# then apply the RLS policy draft:
#   psql "<connection string>" -f supabase/policies/rls_plan.sql
```

### Generate Supabase types later

`src/lib/database.types.ts` is a hand-written **stub**. Replace it with real
generated types after any migration:

```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
# or from a local stack:
npx supabase gen types typescript --local  > src/lib/database.types.ts
```

### Local Supabase development (validate + seed reference data)

This validates that the migration runs and the global **reference data** loads.
It does **not** touch the frontend — the app stays on `localStorage`.

> **Runtime requirement.** `db:seed:refs` runs a **TypeScript** file with bare
> `node` (no ts-node / no build step), relying on Node's native type stripping.
> It needs **Node ≥ 22.6 (with `--experimental-strip-types`) or Node ≥ 23/24**
> (stripping on by default) — same requirement as the existing `import:sources`
> / `build:data` scripts. `db:validate` is plain `.mjs` and runs on any current
> Node. Check with `node -v`; if you're on an older Node, upgrade rather than
> adding a TypeScript-runner dependency.

```bash
# 1. Install the Supabase CLI (any one):
npm install -D supabase            # project-local, run via `npx supabase ...`
#   or: scoop install supabase  /  brew install supabase/tap/supabase
#   Local stack needs Docker Desktop running.

# 2. Start the local stack (Postgres + Studio + Auth) and apply migrations:
npx supabase start                 # first run pulls images; prints local URL + keys

# 3. Apply migrations + run supabase/seed.sql (org, 14 families, RLS helper):
npx supabase db reset              # re-runs ALL migrations then seed.sql (destructive: local only)

# 4. Seed the remaining global reference data (110 controls, sources, mapping).
#    Use the LOCAL service_role key printed by `supabase start` / `supabase status`:
#    PowerShell:
$env:SUPABASE_URL = "http://127.0.0.1:54321"
$env:SUPABASE_SERVICE_ROLE_KEY = "<local service_role key>"
npm run db:seed:refs               # idempotent — safe to re-run

# 5. Validate the reference data (14 families, 110 controls, sources, RLS, …):
npm run db:validate

# 6. (Re)generate types from the local schema:
npx supabase gen types typescript --local > src/lib/database.types.ts
```

- **Reference data only.** `db:seed:refs` seeds the Benchmark Fox org, the 14
  families, all 110 controls, the source registry, and the control→source
  mapping — read straight from the app's TypeScript library so they always
  match. It never seeds clients, evidence, CUI, or sensitive data.
- **Idempotent.** Every write is an upsert on a stable key (org `slug`, family
  `code`, control `natural_id`, `source_id`, `control_id+source_id`).
- **`service_role` is server-only.** `db:seed:refs` / `db:validate` read
  `SUPABASE_SERVICE_ROLE_KEY` from the environment to bypass RLS. **Never**
  commit it, put it in a `VITE_` var, or ship it to the browser.
- **Data-sensitivity rules (repeat).**
  - **Never commit real secrets** — only `.env.example` is tracked; real values
    live in gitignored `.env*` files.
  - **Never seed CUI.**
  - **Never seed real evidence files.**
  - **`evidence_items` are metadata + external links only** (no file column by
    design); `reports` likewise hold metadata + external links only.

### Read-only Supabase reference data mode

The app runs in **two modes**, decided purely by whether the Supabase env vars
are set — **local mode is the default**:

| Mode | When | Behavior |
| --- | --- | --- |
| **Local Prototype** | env vars unset | Uses the generated TypeScript data + `localStorage`. No network. |
| **Supabase Reference Read** | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set | **Reads global reference data** (control families, controls, source references, control/source mappings) from Supabase, with **automatic fallback to local generated data** if a read fails. Shows a **Backend Status** card in Settings. |

This phase is **reads-only and reference-data-only**:

- **No client writes yet.** Intake, scope, control assessments, evidence
  metadata, POA&M, tasks, and reports **still use `localStorage`** — Supabase is
  never written to in this phase (enforced by `src/services/supabaseReadOnlyGuard.ts`).
- **No CUI and no evidence files** are stored, in either mode.
- **No auth / no client portal** yet (planned for the next backend phase, which
  adds RLS-enforced sessions).
- **Fallback is automatic and silent to the user** — if Supabase is unreachable
  or a query errors, the service returns the local generated data and the
  Backend Status card shows `Local fallback` plus the error.

**Architecture (screens never call Supabase directly):**

```
src/lib/backendConfig.ts                 # mode: 'local' | 'supabase-reference-read'
src/services/supabaseReadOnlyGuard.ts    # read-only policy (throws on writes)
src/services/referenceDataService.ts     # Supabase reads + local fallback (the ONLY data path)
src/hooks/useReferenceData.ts            # React hook: data/loading/error/source/refresh
src/components/BackendStatusCard.tsx     # Settings card: mode, source, counts, errors
```

A guard script (`npm run check:supabase-readonly`) fails the build if any
`src/screens/*` file imports the Supabase client/SDK or calls `supabase.from(...)`
— all reads must go through the service/hook layer.

**Enable it locally:** set the env vars (see *Set environment variables* above),
seed reference data (`npm run db:seed:refs`), then open **Settings → Backend
Status**. With the vars unset you'll see: *"Running in local prototype mode. Set
VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable read-only Supabase
reference data."*

**Commands to run:**

```bash
npm run build:data
npm run validate:controls
npm run check:sourcerefs
npm run check:supabase-readonly
npm run typecheck
npm run build
```

## Disclaimer

This is a **readiness-support tool, not an official CMMC assessment platform**.
Nothing here constitutes a certification result, an official SPRS score, or legal,
contracting, or C3PAO determination. SPRS scoring values are placeholders pending
import of the official DoD Assessment Methodology. Always validate against the
official source documents and qualified assessors.
