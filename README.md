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

> **Network note:** this machine sits behind a TLS-intercepting proxy, so npm
> fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` unless TLS verification is
> relaxed. The committed `.npmrc` sets `strict-ssl=false` as a workaround. If you
> can point npm at the proxy's root CA instead (`npm config set cafile …`),
> prefer that and remove the line.

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

## Structure

```
src/
  main.tsx                 # React entry
  App.tsx                  # router, screen-index launcher, tweaks wiring
  types.ts                 # shared types (ScreenKey, tones, tweak values…)
  styles/wireframe.css     # the design system (navy/silver brand tokens)
  components/
    primitives.tsx         # Btn, Field, Badge, Status, charts, Card, Tabs, …
    Shell.tsx              # app shell — sidebar / topnav / hybrid + client tabs
    Brand.tsx              # BrandMark / BrandLockup / BrandLogo (real logo assets)
  tweaks/
    TweaksPanel.tsx        # floating tweaks panel + useTweaks (localStorage)
  screens/
    core.tsx               # Login, Dashboard, Clients, Create Client
    client.tsx             # Client Dashboard, Intake, Path, Scoping
    controls.tsx           # Control Library, Matrix, Detail
    work.tsx               # SSP, POA&M, Evidence, Tasks
    output.tsx             # Reports, Preview, Knowledge, Audit, Settings, Mobile
    index.ts               # barrel
```

## Notes

This is a **prototype** — sample data (Acme Defense @ 62%, score −38, controls
3.1.x) is hard-coded, inputs are non-functional, and there's no backend. The goal
is to validate structure, flow, and the branded visual language before wiring up
the real product on top of this scaffold.
