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
- **Type-safe / builds?** ✅ `npm run typecheck` and `npm run build` pass.
- **Backend?** ❌ None — TypeScript seed + `localStorage` only.

**Complete**
- All 110 NIST SP 800-171 Rev. 2 requirements loaded from a local source file via
  a reproducible generator; official requirement text + family + L1/L2.
- Every major screen is data-driven (no hard-coded client metrics in components):
  internal Dashboard, Clients, Client Dashboard, Control Matrix, Control Detail,
  SSP, POA&M, Evidence, Tasks, Reports, Report Preview, Audit, Knowledge,
  Settings, Mobile.
- Computed metrics (readiness %, status counts, by-family, open POA&Ms, blockers,
  missing/weak evidence, open tasks) centralized in `lib/scoring.ts` + `lib/selectors.ts`.
- Control Matrix: search + filters + inline editable dropdowns persisted to
  `localStorage`; selecting a row opens that control's detail; refresh-safe.
- Source attribution (`sourceRefs.ts` + `Sources`) on Control Detail, SSP, POA&M,
  Evidence, and CMMC Path; every control carries ≥1 source reference.
- Disclaimers/warnings: readiness ≠ certification, scoring-not-finalized, CUI
  handling, POA&M reliance, path-not-legal-advice.
- Type-safe: `npm run typecheck` and `npm run build` pass (strict TS).

**Partially complete**
- Benchmark Fox plain-English explanations / evidence examples / SSP & POA&M
  guidance authored for a curated control subset; remaining controls show TODO
  placeholders.
- Worked client data covers one active engagement (Acme Defense); other clients
  use seed summary rows in the Clients list.

**Placeholder**
- SPRS deduction values (`scoreValue = null`, `scoreSource = 'placeholder'`) pending
  the DoD Assessment Methodology — the SPRS-style score is flagged "scoring not
  finalized" everywhere.
- NIST SP 800-171A assessment objectives (not bundled).
- Intake / Path / Scope are seeded from `intake.ts` / `scope.ts` and are now
  **editable with localStorage persistence** (summary fields, contract/data
  selections, scope assets) — prototype workflows, not yet backed by a database.

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

## Disclaimer

This is a **readiness-support tool, not an official CMMC assessment platform**.
Nothing here constitutes a certification result, an official SPRS score, or legal,
contracting, or C3PAO determination. SPRS scoring values are placeholders pending
import of the official DoD Assessment Methodology. Always validate against the
official source documents and qualified assessors.
