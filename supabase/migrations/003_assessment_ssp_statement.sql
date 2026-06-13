-- ============================================================================
-- 003_assessment_ssp_statement.sql
--
-- Adds the per-client SSP statement text to client_control_assessments.
--
-- WHY: the app's domain model (ClientControlAssessment.sspStatement — the
-- editable SSP statement drafted per control on the Control Detail screen)
-- had no column in 001. Without it the repository layer (Task 04) could not
-- persist SSP statement edits to Supabase. Plain text authored by
-- consultants; SSP statements are readiness work products, not CUI.
--
-- Append-only migration: 001/002 are untouched.
-- ============================================================================

alter table public.client_control_assessments
  add column if not exists ssp_statement text;

comment on column public.client_control_assessments.ssp_statement is
  'Editable SSP statement for this control/client (domain field sspStatement). Authored readiness text — never CUI.';
