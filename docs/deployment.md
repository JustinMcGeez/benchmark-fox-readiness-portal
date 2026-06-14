# Deployment, Environments & Security Headers

> Operational runbook for shipping the Benchmark Fox Readiness Portal (Task 13).
> Repo-wide rules in `CLAUDE.md` apply on top of everything here. Hard rules that
> bear on deployment: **no CUI / no file storage** (evidence = metadata + external
> https links only), the **`service_role` key is never in the browser bundle or a
> `VITE_` var**, and **two runtime modes must always work** (Local Prototype with
> no env vars, and Supabase-backed).

---

## 1. Environments

| Environment | Backend | Host | Trigger | Migrations |
|---|---|---|---|---|
| **dev** (Local Prototype) | none — `localStorage` | local `npm run dev`; the GitHub Pages demo | n/a | n/a |
| **staging** | Supabase **staging** project | Vercel preview (Preview deployment) | every push / PR preview | **auto** on merge to `main` (`migrate-staging.yml`) |
| **production** | Supabase **production** project | Vercel **production** project | promote on Vercel | **manual, approval-gated** (`migrate-production.yml`) |

Notes:

- **dev / Local Prototype** is the default when no env vars are set: the app runs
  entirely on `localStorage`, no auth, no network. This is also what the e2e suite
  and the GitHub Pages demo (`deploy.yml`) run. It must never crash when Supabase
  vars are absent.
- **staging and production are SEPARATE Supabase projects.** Never point staging
  at the production database. Each has its own URL, anon key, and access token.
- The repo keeps **two deploy paths on purpose**: the existing **GitHub Pages**
  workflow (`deploy.yml`) publishes the local-mode demo, and **Vercel** hosts the
  Supabase-backed staging/production app. GitHub Pages cannot set HTTP response
  headers — see §4 for how the CSP is still enforced there.

---

## 2. Environment variable matrix

Only `VITE_`-prefixed vars reach the browser bundle. **All `VITE_` values are
public** (the Supabase anon key is a public key; access is enforced by RLS). The
`service_role` key and the Supabase **access token** are **server/CI-only** and
must never be `VITE_`-prefixed.

| Variable | Scope | dev | staging | production | Set where | Who can see |
|---|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | browser (public) | unset | staging URL | prod URL | Vercel project env (Preview / Production) | anyone (in bundle) |
| `VITE_SUPABASE_ANON_KEY` | browser (public) | unset | staging anon | prod anon | Vercel project env | anyone (in bundle) |
| `VITE_SENTRY_DSN` | browser (public) | optional | staging DSN | prod DSN | Vercel project env | anyone (in bundle) |
| `VITE_BUILD_SHA` | browser (public) | `dev` | commit SHA | commit SHA | CI — auto (see §6) | anyone (in bundle) |
| `VITE_DEPLOY_BASE` | build-time | unset (`./`) | `/` | `/` | `vercel.json` buildCommand | n/a |
| `SUPABASE_ACCESS_TOKEN` | **CI secret** | — | used | used | GitHub repo secrets | maintainers only |
| `SUPABASE_STAGING_PROJECT_REF` | **CI secret** | — | used | — | GitHub repo secrets | maintainers only |
| `SUPABASE_STAGING_DB_PASSWORD` | **CI secret** | — | used | — | GitHub repo secrets | maintainers only |
| `SUPABASE_PRODUCTION_PROJECT_REF` | **CI secret** | — | — | used | GitHub repo secrets | maintainers only |
| `SUPABASE_PRODUCTION_DB_PASSWORD` | **CI secret** | — | — | used | GitHub repo secrets | maintainers only |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | — | seeding/tests only | seeding/tests only | local `.env.local` / CI secret | maintainers only |

`.env.example` documents the same vars. Never commit a real `.env*` (only
`.env.example` is tracked).

---

## 3. Migration flow (staging auto · production manual)

Migrations live in `supabase/migrations/` and are **append-only** (never edit an
applied migration — add a new one).

- **Staging** — `migrate-staging.yml` runs on push to `main` (paths-filtered to
  `supabase/migrations/**`) and runs `supabase db push` against the staging
  project. It **no-ops safely** until `SUPABASE_ACCESS_TOKEN` +
  `SUPABASE_STAGING_PROJECT_REF` are set, so it never blocks merges before the
  staging project exists.
- **Production** — `migrate-production.yml` is **`workflow_dispatch` only — there
  is no push trigger**, so production is never auto-migrated. It requires:
  1. typing the confirmation phrase `migrate-production`, and
  2. an approval on the GitHub **`production` Environment**, which must be
     configured with **Required reviewers**
     (repo → Settings → Environments → `production` → Required reviewers).

  The job pauses for that human approval before any `supabase db push` runs.

**Release order for a schema change:** merge the migration → staging migrates
automatically → verify staging → promote the build on Vercel → run
**Migrate production** (workflow_dispatch) and approve.

---

## 4. Security headers & Content-Security-Policy

The **single source of truth** is `src/lib/securityHeaders.ts`. It is consumed by:

- **`vite.config.ts`** — injects the CSP as a `<meta http-equiv>` into the **built**
  `index.html` (build only; the dev server is untouched so HMR works). This means
  the CSP is enforced on **any** host — including **GitHub Pages, which cannot set
  response headers** — and is verifiable locally with `npm run preview`.
- **`vercel.json`** — serves the SAME CSP **plus** the header-only directives and
  the other hardening headers as real HTTP responses on Vercel.

A unit test (`src/lib/securityHeaders.test.ts`) fails if `vercel.json` drifts from
the module, and `e2e/csp.spec.ts` runs the production build under the CSP and
asserts **zero violations across all 21 screens** and that the docx/xlsx/pdf
generators still work.

### Headers sent (Vercel)

| Header | Value |
|---|---|
| `Content-Security-Policy` | see below |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |

### CSP and why each non-default source exists

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io data:;
worker-src 'self' blob:;
base-uri 'self'; form-action 'self'; object-src 'none';
frame-ancestors 'none';   ← HTTP header only (browsers ignore it in <meta>)
```

- **`script-src 'self'`** — the Vite build emits only external module scripts (zero
  inline `<script>`), so no `'unsafe-inline'`/nonce is needed for scripts.
- **`'wasm-unsafe-eval'`** — the SPRS PDF generator (`@react-pdf`'s yoga-layout)
  instantiates a WebAssembly module. This is the WASM-only CSP3 keyword; it does
  **not** permit `eval` / `new Function`, so XSS string-evaluation stays blocked.
- **`style-src 'unsafe-inline'`** — **the one inline allowance, styles only.** The
  UI sets element `style=""` via React inline-style props throughout, and inline
  style *attributes* cannot be hash/nonce-allowlisted.
- **`style-src`/`font-src` Google Fonts** — `wireframe.css` `@import`s the
  Montserrat/Inter/Roboto-Mono stylesheet from `fonts.googleapis.com`; the font
  files come from `fonts.gstatic.com`.
- **`connect-src` Supabase + Sentry + `data:`** — REST/Auth (https) and Realtime
  (wss) when configured; Sentry ingest when `VITE_SENTRY_DSN` is set; `data:` is
  needed because `@react-pdf` fetches its inlined font metrics/WASM via
  self-contained `data:` URIs (no external origin reachable through it).
- **`worker-src blob:`** — the bundled document generators spawn blob: web workers.
- **`frame-ancestors 'none'` + `X-Frame-Options: DENY`** — the app is never framed.

### Acceptance (manual, on the deployed Vercel URL)

- Run the deployed URL through **https://securityheaders.com** → expect **A** or
  better. (The GitHub Pages demo cannot reach A because it cannot send headers;
  it still enforces the CSP via the `<meta>` tag.)
- `'preload'` in HSTS is only *eligible* until the apex domain is submitted to
  **https://hstspreload.org** — do that once the production domain is final.

---

## 5. Backups & point-in-time recovery (Supabase dashboard)

Backup/PITR settings live in the Supabase dashboard (per project) — configure,
don't script:

- **Production** — enable **Point-in-Time Recovery (PITR)** (Database → Backups).
  Target ≤ 7-day recovery window (raise per the data-retention agreement). PITR
  requires a paid compute add-on; budget for it before go-live.
- **Staging** — daily automated backups are sufficient; PITR optional.
- Record the chosen retention window and the restore procedure owner in the
  internal runbook. Periodically test a restore into a throwaway project.
- The app stores **no CUI and no files** (metadata + external links only), so
  backups contain assessment/intake/scope metadata and audit trail only.

---

## 6. Build SHA / lightweight health surface

`VITE_BUILD_SHA` is injected at build time and shown in **Settings → Backend
Status** (`getBuildSha()` → short SHA, or `dev` locally):

- **GitHub Pages** — `deploy.yml` passes `VITE_BUILD_SHA: ${{ github.sha }}`.
- **Vercel** — `vercel.json` `buildCommand` maps `VITE_BUILD_SHA=$VERCEL_GIT_COMMIT_SHA`.

Backend Status also shows the runtime mode, reference-data source, and counts —
the existing operational/health card.

---

## 7. CI gates (every PR)

`ci.yml` runs on every PR: **typecheck · build:data (official-source validation) ·
build · unit tests · Playwright smoke (incl. the CSP suite) · RLS policy suite ·
`npm audit --omit=dev --audit-level=high` · gitleaks secret scan.**

> **These jobs only *block* a merge once branch protection requires them.** A
> workflow that fails does not by itself stop a merge — that is a repo setting.
> Configure **Settings → Branches → branch protection rule for `main`** with
> **Require status checks to pass before merging** and select: `test`, `audit`,
> `secret-scan`, and `rls`. Without this, the acceptance criterion *"a PR cannot
> merge with failing tests/audit/secret-scan"* is not enforced (see the checklist
> below). This is the CI analogue of the `production` Environment approval gate.

- **`npm audit`** fails on **high/critical** production-dependency advisories.
  Lower severities are tracked here, not blocked.
  - *Known accepted (moderate):* `uuid <11.1.1` (missing buffer bounds check)
    reaches the bundle transitively via `exceljs`. It is **moderate**, only used
    for spreadsheet generation with non-attacker-controlled input, and the only
    fix is a breaking `exceljs` downgrade. Re-evaluate when `exceljs` ships a
    patched `uuid`.
- **gitleaks** scans the full git history; a committed secret fails the build.
  *(A GitHub **organization** account additionally needs a `GITLEAKS_LICENSE`
  secret — a personal/public repo does not.)*

## 8. Dependency maintenance (Dependabot)

`.github/dependabot.yml`: weekly (Monday) for **npm** and **github-actions**,
minor/patch grouped into one PR per ecosystem to cut noise. **Security** updates
for known advisories are opened immediately, regardless of the weekly schedule.
New UI libraries are never auto-added — version bumps only, all through CI.

---

## One-time human setup checklist

- [ ] Create the **staging** and **production** Supabase projects; apply all
      `supabase/migrations/**` to each (staging via CI once secrets are set).
- [ ] Create the **Vercel** staging (Preview) and production projects; set the
      `VITE_*` env vars per §2.
- [ ] Add GitHub repo secrets: `SUPABASE_ACCESS_TOKEN`,
      `SUPABASE_STAGING_PROJECT_REF`, `SUPABASE_STAGING_DB_PASSWORD`,
      `SUPABASE_PRODUCTION_PROJECT_REF`, `SUPABASE_PRODUCTION_DB_PASSWORD`.
- [ ] **Enable branch protection on `main`** (Settings → Branches): *Require status
      checks to pass before merging* → select `test`, `audit`, `secret-scan`, `rls`.
      This is what actually enforces *"a PR cannot merge with failing
      tests/audit/secret-scan"* (the workflows alone do not block merges — see §7).
- [ ] Configure the GitHub **`production` Environment** with **Required reviewers**
      (the production-migration approval gate).
- [ ] Enable **PITR** on the production Supabase project.
- [ ] Run the deployed Vercel URL through **securityheaders.com** (expect A+) and
      submit the apex domain to **hstspreload.org**.
