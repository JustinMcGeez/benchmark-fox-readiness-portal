# Benchmark Fox Readiness Portal

A polished, clickable prototype of the **Benchmark Fox Readiness Portal**, a
CMMC readiness command center. Built as a **Vite + React + TypeScript** app with
full **Benchmark Fox branding** — navy + silver palette, the BF fox monogram,
Montserrat/Inter typography, and crisp Lucide line icons.

## Run it

```bash
npm install
npm run dev      # start the dev server (opens http://localhost:5173)
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
npm run typecheck
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

Screen values are **computed from a structured data layer**, not hard-coded text:

```
src/
  data/
    types.ts        # domain interfaces (Client, Control, ClientControlAssessment,
                    #   EvidenceItem, PoamItem, TaskItem, ReportItem, AuditEvent)
                    #   + status option lists
    clients.ts      # clients + audit log + CURRENT_CLIENT_ID
    controls.ts     # control library, family summary, seed assessments
    evidence.ts     # evidence items
    poam.ts         # POA&M items
    tasks.ts        # remediation tasks
    reports.ts      # report deliverables + export formats
    store.ts        # <DataProvider> — seed merged with localStorage edits;
                    #   useData() exposes assessments, updateAssessment, selectControl
  lib/
    scoring.ts      # isolated scoring engine (readiness %, SPRS score, by-family)
```

- **Client Dashboard** and **Control Matrix** derive readiness %, SPRS score,
  status counts, open POA&Ms, blockers, missing evidence, and score-by-family
  from the assessments via `lib/scoring.ts`.
- The **Control Matrix** has real search + family/status/SSP/evidence filters and
  inline dropdowns for readiness, SSP, evidence, POA&M status and owner. Edits
  **persist to `localStorage`** (`bf_assessments_v1`) and update the dashboard
  live. Clicking a row opens **Control Detail** for that control.
- **Scoring is intentionally isolated** in `lib/scoring.ts` so the prototype model
  (Met = 0 deduction, otherwise full; readiness gives Partial half credit) can be
  swapped for official CMMC/SPRS rules without touching any screen.
- **No backend.** `store.ts` is the seam where Supabase/Postgres will slot in.

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
  tweaks/TweaksPanel.tsx   # floating tweaks panel + useTweaks (localStorage)
  screens/                 # core / client / controls / work / output + index barrel
```

## Notes

This is a **prototype** — seed data describes one active engagement (Acme Defense),
inputs other than the matrix dropdowns are non-functional, and there's no backend.
Matrix edits persist locally; clear them by removing the `bf_*` keys from
`localStorage`. The goal is a working, data-driven internal prototype before
Supabase/Postgres integration.
