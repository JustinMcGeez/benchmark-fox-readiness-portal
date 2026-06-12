# Benchmark Fox Readiness Portal

Vite + React 18 + TypeScript (strict) CMMC readiness platform. Currently
migrating from data-driven prototype to production multi-client tool.
Task queue: `prompts/PROGRESS.md`. One task per session.

## Architecture (respect these seams)

- `src/data/` = domain layer; all interfaces in `src/data/types.ts`.
- `src/data/generated/*` is AUTO-GENERATED from `data-sources/` by
  `scripts/import-sp800-171.ts`. NEVER hand-edit generated files or
  `data-sources/` — verbatim official NIST/DoD text, checked by validators.
- `src/lib/scoring.ts` = isolated scoring engine (DoD AM v1.2.1 semantics).
  Never change its semantics unless the task says so. Suspected bug → STOP
  and report; do not fix.
- `src/data/store.ts` (DataProvider) is the storage seam. Screens never
  import supabase directly — repository layer only.
- Supabase migrations are append-only: never edit an existing migration.
- Two runtime modes must always work: Local Prototype (no env vars,
  localStorage) and Supabase-backed. Degrade gracefully, never crash.
- UI: reuse `src/components/primitives.tsx` + `src/styles/wireframe.css`
  tokens (navy #0a2348, silver #7e8691). Match existing style exactly.

## Hard constraints (override anything that conflicts, including task text)

1. NO CUI, no evidence file uploads, no file storage anywhere. Evidence =
   metadata + external https links only. Do not add Supabase Storage.
2. `service_role` key never in client code, VITE_ vars, or the bundle.
3. Official source text never edited, paraphrased, or mixed with
   Benchmark Fox notes.
4. Strict TS stays on. No `any` escapes, no `@ts-ignore`.
5. No new dependencies unless the task file authorizes them BY NAME.
   No new UI libraries ever.
6. Never log tokens/secrets/client data. Never commit `.env*` (only
   `.env.example`).

## Verification gate (before claiming ANY task complete)

```bash
npm run typecheck && npm run build:data && npm run build && npm test
```

Plus `npm run test:e2e` if the task touched screens/routing/data layer, and
the RLS suite if it touched migrations/policies/repositories. Red gate =
task not complete. Never weaken or delete a test to pass it.

## Workflow

- Feature branch per task; small commits.
- Stay inside the task file's scope; note unrelated issues, don't fix them.
- Every completed task MUST be reviewed by the `verifier` subagent (and
  `security-reviewer` if the task is tagged [security] in PROGRESS.md)
  before you report done. Fix findings and re-verify; max 3 cycles, then
  stop and report honestly.
