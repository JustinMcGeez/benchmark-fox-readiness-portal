# Task 13 — CI/CD hardening, environments, security headers

> Repo-wide rules live in CLAUDE.md and apply on top of everything below.

TASK: Production deployment hygiene. The repo deploys via
.github/workflows/deploy.yml (read it first and adapt — do not blow it away).

1. Environments: define dev (Local Prototype), staging, production. Staging =
   its own Supabase project + Vercel preview env; production = separate project.
   Document the env var matrix in docs/deployment.md (which VITE_ vars, where
   set, who can see them). Migrations flow: applied to staging on merge to main
   (supabase db push in CI with a staging access token from GitHub secrets),
   applied to production by a manually-approved workflow_dispatch job. NEVER
   auto-migrate prod on push.
2. CI gates on PRs (extend ci.yml): typecheck, build:data, build, unit tests,
   Playwright smoke, RLS suite, plus: npm audit --omit=dev fails on high/critical,
   and a secret scan (gitleaks action).
3. Security headers: add vercel.json (or update the existing deploy config)
   with: Content-Security-Policy (default-src 'self'; connect-src 'self'
   https://*.supabase.co plus Sentry ingest if configured; img-src 'self' data:;
   font-src per the actual font loading — check how Montserrat/Inter load and
   set accordingly), X-Content-Type-Options nosniff, Referrer-Policy
   strict-origin-when-cross-origin, Permissions-Policy minimal,
   Strict-Transport-Security. Verify the app actually runs under the CSP (no
   inline-script violations from Vite output; adjust safely, document any
   'unsafe-inline' you are forced to keep for styles and why).
4. Dependabot (or Renovate) config: weekly, grouped minor/patch, security
   updates immediate.
5. Backups note: document Supabase PITR/backup settings to enable per
   environment in docs/deployment.md (settings live in the dashboard — document,
   don't script).
6. A lightweight /health check: the app footer's existing BackendStatusCard
   pattern extended to show build SHA (inject via VITE_BUILD_SHA in CI).

ACCEPTANCE: a PR cannot merge with failing tests/audit/secret-scan; prod
migrations require manual approval; the deployed app passes securityheaders.com
with A or better; CSP causes zero console violations on all 21 screens.
