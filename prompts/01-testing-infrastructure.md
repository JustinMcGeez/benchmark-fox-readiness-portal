# Task 01 — Testing infrastructure (Vitest + Playwright + CI)

> Repo-wide rules live in CLAUDE.md and apply on top of everything below.

TASK: Add a complete testing foundation to this repo. There are currently ZERO
tests. This must land before any backend work so later changes are protected.

AUTHORIZED NEW DEV-DEPENDENCIES: vitest, @vitest/coverage-v8, jsdom,
@testing-library/react, @testing-library/jest-dom, @testing-library/user-event,
@playwright/test. Nothing else.

PART A — Vitest unit tests
1. Add vitest config (vitest.config.ts) using the existing vite.config.ts as a
   base, environment 'jsdom', globals true, setup file that registers
   @testing-library/jest-dom matchers.
2. Add scripts to package.json: "test": "vitest run", "test:watch": "vitest",
   "test:coverage": "vitest run --coverage", "test:e2e": "playwright test".
3. Write unit tests for src/lib/scoring.ts — this is the most important file in
   the codebase. Cover AT MINIMUM:
   - Estimated SPRS score starts at 110 with all controls Met.
   - 'Not Met' and 'Not Reviewed' subtract the control's full deduction value.
   - 'Partial' is treated as Not Met for the SPRS estimate (full deduction) but
     receives half credit in the readiness % — verify BOTH behaviors separately.
   - 'Not Applicable' and 'Met' subtract nothing.
   - Control 3.12.4 (NA in Annex A) never deducts points regardless of status.
   - Score can go below zero when deductions exceed 110.
   - By-family breakdown sums correctly across the 14 families.
   - Readiness % is 100 when all Met, 0 when all Not Met.
   Use the real generated control library as fixture input where practical, plus
   small hand-built fixtures for edge cases. DO NOT modify scoring.ts to make
   tests pass — if you believe scoring.ts has a bug, STOP and report it instead.
4. Write unit tests for src/lib/selectors.ts (open POA&M counts, blockers,
   missing/weak evidence, topFindings ordering) and src/lib/objectives.ts
   (objective coverage math).
5. Write unit tests for the localStorage persistence in src/data/store.ts:
   loadJson/saveJson round-trip, corrupt-JSON fallback to seed, override merge
   behavior (clientId:controlId keying), and reset-to-seed clearing bf_* keys.
6. Write a data-integrity test that imports the generated control library and
   asserts: exactly 110 controls, 14 families, no duplicate ids, every control
   has a scoring record (−5/−3/−1 or the single NA), objective counts total 320,
   every control has ≥1 source reference. (This duplicates the validate scripts
   on purpose — it makes the guarantees visible in the test suite.)

PART B — Playwright smoke tests
7. Add playwright.config.ts that starts the vite dev server (webServer config)
   and runs against chromium only for now.
8. Write smoke tests: (a) app loads, login screen renders with Benchmark Fox
   branding; (b) navigate to ?screen=controls, the Control Matrix renders 110
   rows (or its paginated equivalent), search for "3.1.1" filters to it;
   (c) change a control's readiness status via the inline dropdown, reload the
   page, assert the change persisted (localStorage); (d) ?screen=dashboard shows
   a numeric readiness % and SPRS estimate; (e) the Screens index (g key) opens
   and lists 21 screens.

PART C — CI
9. Add .github/workflows/ci.yml (do NOT touch the existing deploy.yml) that on
   pull_request and push to main runs: npm ci, npm run typecheck, npm run
   build:data, npm run build, npm test, and the Playwright smoke suite (with
   npx playwright install --with-deps chromium). Cache node_modules via
   actions/setup-node cache: 'npm'.

ACCEPTANCE CRITERIA
- npm test passes locally with ≥ 25 meaningful assertions across scoring,
  selectors, store, and data integrity.
- npm run test:e2e passes locally.
- CI workflow is syntactically valid and runs all gates.
- Zero changes to src/lib/scoring.ts, generated files, or data-sources/.
- Report coverage % for src/lib/ when done.
