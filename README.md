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
npm run validate:guidance # validate Benchmark Fox guidance covers all 110 controls
npm run build:data        # import:sources + all validators + check:sourcerefs
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
- Every screen has a real URL (react-router, see the Route column below) —
  deep-link or refresh any of them. Client screens are scoped as
  `/clients/:clientId/…` (seed client: `acme`); an unknown client id redirects
  to `/clients`.
- Legacy `?screen=<key>` links (e.g. `/?screen=controls`) still work — they
  redirect to the new route (mapping lives in `src/routes.tsx`).
- **⚙ Tweaks** panel (bottom-right) toggles the **nav style**
  (sidebar / topnav / hybrid) and **spacing** density. Choices persist to
  `localStorage`.

### Screen map

| #  | Screen              | Key                | Route                                   |
|----|---------------------|--------------------|-----------------------------------------|
| 01 | Login               | `login`            | `/login`                                |
| 02 | Internal Dashboard  | `dashboard`        | `/dashboard`                            |
| 03 | Clients List        | `clients`          | `/clients`                              |
| 04 | Create Client       | `create-client`    | `/clients/new`                          |
| 05 | Client Dashboard    | `client-dashboard` | `/clients/:clientId`                    |
| 06 | Guided Intake       | `intake`           | `/clients/:clientId/intake`             |
| 07 | CMMC Path           | `path`             | `/clients/:clientId/path`               |
| 08 | Scoping Workspace   | `scope`            | `/clients/:clientId/scope`              |
| 09 | Control Library     | `control-library`  | `/library`                              |
| 10 | Control Matrix ★    | `controls`         | `/clients/:clientId/controls`           |
| 11 | Control Detail      | `control-detail`   | `/clients/:clientId/controls/:controlId`|
| 12 | SSP Workspace       | `ssp`              | `/clients/:clientId/ssp`                |
| 13 | POA&M Tracker       | `poam`             | `/clients/:clientId/poam`               |
| 14 | Evidence Hub        | `evidence`         | `/clients/:clientId/evidence`           |
| 15 | Task Management     | `tasks`            | `/clients/:clientId/tasks`              |
| 16 | Reports             | `reports`          | `/clients/:clientId/reports`            |
| 17 | Report Preview      | `report-preview`   | `/clients/:clientId/reports/preview`    |
| 18 | Knowledge Base      | `knowledge`        | `/knowledge`                            |
| 19 | Audit Log           | `audit`            | `/audit`                                |
| 20 | Settings            | `settings`         | `/settings`                             |
| 21 | Mobile Direction    | `mobile`           | `/mobile`                               |

Unknown URLs render a NotFound screen with a link back to `/dashboard`. `/`
restores the last visited screen (else `/login`). All routes except `/login`
are wrapped in a `<ProtectedRoute>` placeholder (a pass-through until real
auth lands).

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

Three local source files are the source of truth for the control library:
- `data-sources/sp800-171r2.json` — the 110 official requirement statements.
- `data-sources/dod-assessment-methodology-scoring.json` — the official SPRS
  deduction value (−5/−3/−1, or NA) for each requirement, from the DoD Assessment
  Methodology v1.2.1 (Annex A).
- `data-sources/sp800-171a-assessment-objectives.json` — the official NIST SP
  800-171A assessment objectives (320 determination statements + examine/
  interview/test methods) for the 110 controls.

`scripts/import-sp800-171.ts` merges them into
`src/data/generated/controls.generated.ts` (and **fails** if a scoring/objective
id does not match a control, or a control has no scoring record or no objectives
— values are never guessed). `scripts/validate-controls.mjs`,
`scripts/validate-scoring.mjs`, and `scripts/validate-assessment-objectives.mjs`
check the result (count = 110, 14 families, no duplicates, `nist-sp-800-171r2`
cited, official −5/−3/−1/NA scoring, and 320 unique official objectives):

```bash
npm run build:data         # import + validate:controls + validate:scoring + validate:objectives + validate:guidance + check:sourcerefs
npm run validate:scoring   # scoring data <-> control library cross-check
npm run validate:objectives # 800-171A objectives <-> control library cross-check
npm run validate:guidance  # Benchmark Fox guidance completeness for all 110 controls
```

To import other official data we don't bundle yet, drop the file in
`data-sources/`, extend the importer, and re-run —
no screen changes required.

### What is data-driven vs. placeholder

| Area | State |
| --- | --- |
| 110 requirement texts, numbers, families, L1/L2 applicability | ✅ official (NIST 800-171 Rev. 2) |
| Readiness %, status counts, dashboards, matrix, detail, SSP/POA&M/Evidence/Tasks/Reports/Mobile | ✅ computed from data |
| Intake summary, CMMC path recommendation, scope summary + assets | ✅ data-driven **and editable** (`intake.ts` / `scope.ts`, persisted to localStorage) |
| SPRS deduction values (`sprsDeductionValue`, `scoreValue`, `scoreSource`) | ✅ **official** — all 110 from the DoD Assessment Methodology v1.2.1, Annex A (`data-sources/dod-assessment-methodology-scoring.json`). Distribution −5:44 · −3:14 · −1:51 · NA:1 (3.12.4) |
| Assessment objectives (800-171A) | ✅ **official** — all 320 NIST SP 800-171A determination statements for the 110 controls (`data-sources/sp800-171a-assessment-objectives.json`), with examine/interview/test methods. Official text is kept separate from Benchmark Fox notes |
| Plain-English explanations / common mistakes / evidence examples / implementation & interview guidance / SSP & POA&M guidance | ✅ **Benchmark Fox-authored guidance covers all 110 controls** and is validated by `npm run validate:guidance`. Authored overlay content (`BF_OVERLAY` in `src/data/controls.ts`) — kept strictly separate from official source text |

### NIST SP 800-171A assessment objectives (official)

Every control carries its **official NIST SP 800-171A assessment objectives** —
the determination statements (e.g. `3.1.1[a] authorized users are identified.`)
with their assessment methods (**examine / interview / test**). All **320**
objectives across the 110 controls are bundled in
`data-sources/sp800-171a-assessment-objectives.json` and loaded into the
generated control library (validated by `npm run validate:objectives`).

- **Official text stays separate from Benchmark Fox guidance.** `objectiveText`
  is verbatim official source text; any Benchmark Fox readiness note lives in a
  separate `benchmarkFoxNotes` field — the two are never mixed.
- **Evidence maps at control and objective level.** Evidence metadata can
  reference a `controlId` and optional `objectiveIds`; if none are selected the
  evidence still maps to the control. **Metadata only — no evidence files are
  stored.**
- **Where it shows up:** Control Detail lists the objectives + methods; Evidence
  Hub shows objective coverage; SSP Workspace shows an objective-coverage
  indicator per control; Reports summarize objective coverage and top controls
  needing objective evidence.
- **Readiness support only.** Objectives describe what an assessor *may* examine,
  interview, or test — this is **not** an official CMMC assessment, C3PAO result,
  legal opinion, certification guarantee, or contract award guarantee.
- **Source:** NIST SP 800-171A (public-domain U.S. Government work), extracted
  from the official NIST publication and validated (110 groups, 320 unique
  objectives, methods restricted to examine/interview/test, no placeholders).

### Benchmark Fox guidance (authored overlay, all 110 controls)

Every control carries **Benchmark Fox-authored plain-English guidance**: an
explanation, common mistakes, evidence examples, implementation and interview
guidance, SSP statement guidance, and POA&M guidance. Key properties:

- **Official source text remains official and separate.** The NIST requirement
  text and 800-171A objective text are never rewritten or mixed with authored
  content. Benchmark Fox guidance is **authored overlay content** living in
  `BF_OVERLAY` in `src/data/controls.ts`, merged onto the generated official
  skeleton at load time.
- **Coverage is validated.** `npm run validate:guidance` (also part of
  `build:data`) verifies all 110 controls have complete guidance with no
  placeholder language, and that official requirement/objective text was not
  copied off as the authored explanation. Guidance covers all 110 controls when
  this validation passes.
- **Bracketed values are client variables.** Placeholders like
  `[identity provider]`, `[EDR solution]`, or `[SIEM/logging platform]` are
  intentional client-fillable variables — the guidance never invents
  client-specific implementation details.
- **Where it shows up:** Control Detail (explanation, common mistakes, evidence
  examples, implementation/interview guidance on Overview/Guidance tabs; SSP and
  POA&M guidance on their tabs), and the SSP Workspace statement editor.
- **Readiness guidance only.** This content supports CMMC readiness work. It is
  **not legal advice, not a C3PAO assessment result, and not a certification
  guarantee**.

### SPRS scoring (official, estimated)

The app computes an **estimated SPRS score** from the official DoD Assessment
Methodology point values (start at 110; subtract each control's −5/−3/−1 value
when not implemented). It is a **readiness estimate from the current app inputs,
not an official assessment result**. Key handling, isolated in `lib/scoring.ts`:

- **Met / Not Applicable** → no deduction. **Not Met / Not Reviewed** → full
  deduction (you only earn points for implemented requirements).
- **Partial** is **not** an official SPRS status. It is treated **conservatively
  as Not Met** (full deduction) for the estimate, and clearly labeled in the UI;
  the readiness % gives Partial half credit as an internal readiness estimate only.
- **3.12.4** (System Security Plan) is **NA** in Annex A — not point-scored; its
  absence blocks an assessment rather than deducting points. Represented as a 0
  deduction with a documented note, never a guessed value.
- The estimate can go **below zero** if deductions exceed 110.

**Source of truth:** NIST SP 800-171 DoD Assessment Methodology, **Version 1.2.1
(June 24, 2020)**, Annex A scoring template. Values were extracted from the
official document and cross-checked against its Section 5 narrative lists (the 42
five-point requirements + the two "3 to 5" special cases 3.5.3 / 3.13.11, base
−5). They are **not** sourced from blogs or guesses; see
`data-sources/dod-assessment-methodology-scoring.json` and `npm run validate:scoring`.

## App structure

```
src/
  main.tsx                 # React entry (wraps App in <DataProvider>)
  App.tsx                  # router host (BrowserRouter), screen-index launcher, tweaks
  routes.tsx               # route tree (react-router v6), ScreenKey↔path map, legacy ?screen= redirect
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
- **Scoring values official or placeholder?** ✅ Official — all 110 SPRS deduction
  values from the DoD Assessment Methodology v1.2.1 (Annex A). The app shows an
  **estimated** SPRS score (not an official assessment result).
- **Intake / Scope editable?** ✅ Yes — localStorage-backed, with auto-save and reset-to-seed.
- **Type-safe / builds?** ✅ `npm run typecheck` and `npm run build` pass.
- **Backend?** 🟢 **Supabase Reference Read (read-only).** When
  `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set, the app **reads global
  reference data** (control families, controls, source references, control/source
  mappings) from Supabase via the service/hook/provider layer, with automatic
  local fallback; otherwise it runs in **Local Prototype** mode. **Client edits
  still use `localStorage`** this phase (no writes, no auth, no CUI). See
  **Backend** below.

**Complete**
- All 110 NIST SP 800-171 Rev. 2 requirements loaded from a local source file via
  a reproducible generator; official requirement text + family + L1/L2.
- **Official SPRS scoring for all 110 controls** from the DoD Assessment
  Methodology v1.2.1 (Annex A): every control carries its −5/−3/−1 deduction
  (3.12.4 = NA). The app computes an **estimated** SPRS score (110 minus
  deductions for unmet controls; Partial counted conservatively as Not Met).
  Validated by `npm run validate:scoring`.
- **Official NIST SP 800-171A assessment objectives for all 110 controls** — 320
  determination statements with examine/interview/test methods, official text kept
  separate from Benchmark Fox notes. Shown in Control Detail; objective coverage in
  Evidence Hub, SSP Workspace, and Reports. Validated by `npm run validate:objectives`.
- **Benchmark Fox-authored guidance for all 110 controls** — plain-English
  explanation, common mistakes, evidence examples, implementation/interview
  guidance, SSP guidance, and POA&M guidance, authored as overlay content kept
  separate from official source text. Validated by `npm run validate:guidance`
  (no placeholder language, no official text copied off as authored guidance).
  Readiness guidance only — not legal advice, not a C3PAO assessment result,
  and not a certification guarantee.
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
- Worked client data covers one active engagement (Acme Defense); its Clients-list
  row computes live (readiness/score from assessments, labeled `live`). Clients
  without assessments show **"Seed summary only"** / **"Not started"** instead of
  fake computed scores.

**Placeholder**
- Intake / Path / Scope are seeded from `intake.ts` / `scope.ts` and are
  **editable with localStorage persistence** (summary fields, contract/data
  selections, scope assets) — auto-saved with reset-to-seed controls; prototype
  workflows, not yet backed by a database.

**Known limitations**
- No client-data backend yet; Supabase Reference Read is implemented for global
  reference data only.
- Single active demo client.
- Auth is still a prototype shell.
- Client-specific data still uses localStorage this phase.
- Intake/Path form option lists and Settings non-table panels remain inline mockups.
- SPRS scoring uses the official DoD Assessment Methodology point values, but the
  **score is an estimate** from the app's current readiness inputs — not an
  official assessment result (Partial counted conservatively as Not Met).

**Next recommended build phase**
1. Introduce Supabase/Postgres behind `data/store.ts` (multi-client, real auth,
   evidence metadata + approved secure external links) — the data interfaces are
   already the seam for this. (No CUI or real evidence files are stored.)

## Backend (Supabase / Postgres)

- **Backend target:** **Supabase / Postgres** (managed Postgres + Auth + Row
  Level Security).
- **Current status:** **Supabase Reference Read (read-only) is implemented.** The
  app runs in two modes:
  - **Local Prototype** — when the Supabase env vars are missing (default). Uses
    the generated TypeScript data + `localStorage`.
  - **Supabase Reference Read** — when `VITE_SUPABASE_URL` +
    `VITE_SUPABASE_ANON_KEY` are set. The app may **read global reference data**
    (control families, controls, source references, control/source mappings) from
    Supabase through the service → hook → provider layer, with **automatic
    fallback to the local generated data** if a read fails.
- **Client-specific data still lives in `localStorage` this phase**
  (`src/data/store.ts`): assessments, intake, scope, evidence metadata, POA&M,
  tasks, reports. **No Supabase writes, no auth, no client portal yet** — those
  are **Phase 3**.
- **Never stored in Supabase:** CUI, real evidence files, SSP files, POA&M files,
  screenshots, configs, logs, or rendered client report artifacts. Reference data
  and metadata + secure external links only.
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
src/lib/supabaseClient.ts                # typed, config-gated client (read-only reads; warns if unconfigured)
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

This is the **server-side** path for proving the migration runs and seeding the
global **reference data** into Postgres (it uses the `service_role` key and is
unrelated to how the frontend reads). Once the data is seeded and the frontend's
`VITE_` env vars are set, the app's **Supabase Reference Read** mode reads that
global reference data; **client-specific edits still use `localStorage`** this
phase. See *Read-only Supabase reference data mode* below.

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

A guard script (`npm run check:supabase-readonly`) scans **all of `src/`** and
fails if a `src/screens/*` file imports the Supabase client/SDK or calls
`supabase.from(...)`, if anything imports `@supabase/supabase-js` outside
`src/lib/supabaseClient.ts`, or if any `src/` file performs a Supabase write
(`.insert/.update/.upsert/.delete`). All reads flow through
`referenceDataService` → `useReferenceData` → `ReferenceDataProvider`
(`useReference()`).

**End-to-end validation flow (Supabase reference read):**

```bash
# 1. Start a local Supabase stack + apply migrations + seed.sql:
npx supabase start
npx supabase db reset

# 2. Seed + validate reference data (service_role key is server-only):
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_SERVICE_ROLE_KEY=<local service_role key>
npm run db:seed:refs
npm run db:validate

# 3. Point the FRONTEND at Supabase (anon key) via .env.local, then run the app:
#    .env.local:
#      VITE_SUPABASE_URL=http://127.0.0.1:54321
#      VITE_SUPABASE_ANON_KEY=<local anon key>
npm run dev

# 4. Open Settings → Backend Status. It should show:
#      Backend mode: Supabase Reference Read · Supabase configured: Yes
#      Reference data source: Supabase · counts for families/controls/sources/links
```

With the `VITE_` vars unset, the app stays in local prototype mode and Backend
Status shows: *"Running in local prototype mode. Set VITE_SUPABASE_URL and
VITE_SUPABASE_ANON_KEY to enable read-only Supabase reference data."* If a
Supabase read fails, the card shows **Local fallback** plus the error — the app
keeps working. **Client edits still use localStorage in this phase.**

**Commands to run:**

```bash
npm run build:data
npm run validate:controls
npm run check:sourcerefs
npm run check:supabase-readonly
npm run typecheck
npm run build
```

## Error monitoring & privacy (Sentry)

Production error monitoring is **opt-in** and **privacy-first**. It is enabled only
when `VITE_SENTRY_DSN` is set; with the var unset (the default, and Local Prototype
mode) monitoring is fully disabled, **Sentry is dead-code-eliminated from the
bundle**, and the app behaves identically. The DSN is a **public** value (safe to
ship); never put a Sentry **auth token** in a `VITE_` var.

- **What is captured:** uncaught **errors** and **unhandled promise rejections**
  only. **No** performance tracing, **no** session replay, **no** breadcrumbs.
- **What is sent — strict allowlist (`beforeSend` / `scrubEvent` in
  [`src/lib/monitoring.ts`](src/lib/monitoring.ts)):** only the error
  **type / message / stack-frame locations** (file, function, line, column,
  in_app), a few non-identifying envelope fields (event id, timestamp, level,
  platform, environment, release, SDK), and our own random **`error_id`** tag.
- **What is dropped:** request URL (which can contain client ids), the user
  (email / id / IP), `contexts`, `extra`, **breadcrumbs**, server name, the
  top-level `message`, and stack-frame **local variables / source-context
  lines**. This means **no emails, client names, or intake/scope free-text** can
  leave the browser. The allowlist is proven by
  [`src/lib/monitoring.test.ts`](src/lib/monitoring.test.ts).
- **No CUI, ever** — consistent with the product-wide rule, no CUI or client
  evidence is sent to monitoring.

### Resilience

- **Error boundaries** — a top-level branded "Something went wrong" panel
  (Reload + a copyable error id) plus a per-screen boundary so one screen
  crashing leaves the navigation and the rest of the shell usable; it auto-clears
  when you navigate. The copyable **error id** matches the `error_id` tag on the
  captured Sentry event (when configured).
- **Offline / spotty network** — a connectivity banner appears when the browser
  goes offline. In Supabase mode reads pause and queued writes are held by
  TanStack Query (`networkMode: 'online'`) and resume on reconnect; in Local
  Prototype mode edits persist to `localStorage`.
- **Read retry vs. write safety** — the Supabase repository retries **reads**
  with 3-attempt jittered backoff (transient failures only). **Writes are NEVER
  auto-retried** (duplicate-write risk) — a failed write surfaces a **Retry**
  button so the user decides.

## Disclaimer

This is a **readiness-support tool, not an official CMMC assessment platform**.
Nothing here constitutes a certification result, an official SPRS score, or legal,
contracting, or C3PAO determination. The SPRS deduction values are the official
DoD Assessment Methodology weights, but the score the app shows is an **estimate**
computed from the current readiness inputs — not an official assessment, C3PAO
result, certification guarantee, or contract award guarantee. Always validate
against the official source documents and qualified assessors.
