# Build Queue — Benchmark Fox Readiness Portal

Rules: strictly in order. One task per Claude Code session (/clear between).
Merge each task's branch before starting the next. [security] tasks get the
security-reviewer subagent in addition to verifier.

- [ ] 01 — Testing infrastructure (Vitest + Playwright + CI) — prompts/01-testing-infrastructure.md
- [ ] 02 — React Router, client-scoped URLs — prompts/02-react-router.md
- [ ] 03 — Supabase Auth [security] — prompts/03-supabase-auth.md
- [ ] 04 — Repository layer: localStorage → Supabase [security] — prompts/04-repository-layer.md
- [ ] 05 — RLS hardening + automated policy tests [security] — prompts/05-rls-hardening.md
- [ ] 06 — Real audit logging — prompts/06-audit-logging.md
- [ ] 07 — Client CRUD + assignments — prompts/07-client-crud.md
- [ ] 08 — Evidence lifecycle workflow — prompts/08-evidence-workflow.md
- [ ] 09 — SSP generator (.docx) — prompts/09-ssp-docx.md
- [ ] 10 — POA&M (.xlsx) + SPRS report (.pdf) — prompts/10-poam-xlsx-sprs-pdf.md
- [ ] 11 — Client portal (role-scoped) [security] — prompts/11-client-portal.md
- [ ] 12 — Resilience pass (errors, Sentry, a11y) — prompts/12-resilience-pass.md
- [ ] 13 — CI/CD hardening + security headers — prompts/13-cicd-hardening.md

## Completed log
(/build-next appends here: date, task, one-line summary)
