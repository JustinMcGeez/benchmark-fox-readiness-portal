-- ============================================================================
-- 008_intake_system_name.sql
--
-- Adds the named information system to intake_records.
--
-- WHY: the SSP deliverable (Task 09) needs a System Name for its cover page and
-- System Identification section. The app's domain model gained
-- IntakeState.systemName (an editable intake field), so the repository layer
-- needs a column to persist it. Plain readiness metadata authored by
-- consultants — the SYSTEM'S name, never CUI.
--
-- Append-only migration: 001–007 are untouched. No RLS change — intake_records
-- already carries its tenancy policies from 004; a new nullable text column is
-- covered by the existing row-level policies.
-- ============================================================================

alter table public.intake_records
  add column if not exists system_name text;

comment on column public.intake_records.system_name is
  'Name of the information system the SSP describes (domain field systemName). Readiness metadata — never CUI.';
