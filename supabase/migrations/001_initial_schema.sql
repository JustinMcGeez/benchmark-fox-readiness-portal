-- ============================================================================
-- Benchmark Fox Readiness Portal — initial schema (001)
-- Target: Supabase / Postgres
--
-- This migration is ADDITIVE and NOT YET WIRED INTO THE APP. The frontend still
-- runs on TypeScript seed data + localStorage (see src/data/store.ts). It
-- establishes the backend foundation that will later replace localStorage.
--
-- ============================================================================
-- !!  MVP DATA-SENSITIVITY RULE — HARD CONSTRAINT  !!
-- Do NOT store CUI (Controlled Unclassified Information) or real sensitive
-- client evidence FILES in this database during the MVP. Store readiness
-- metadata, control statuses, SSP/POA&M/task/report METADATA, audit logs, and
-- evidence METADATA + approved SECURE EXTERNAL LINKS only. See evidence_items.
-- ============================================================================

begin;

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Shared helpers
-- ----------------------------------------------------------------------------

-- Auto-maintain updated_at on UPDATE.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Enumerated types  (mirror src/data/types.ts string unions)
-- ----------------------------------------------------------------------------
create type risk_level         as enum ('Low', 'Medium', 'High', 'Critical');

create type app_role           as enum (
  'benchmark_fox_admin',
  'benchmark_fox_consultant',
  'client_executive',
  'client_it_owner',
  'evidence_uploader',
  'readonly_viewer'
);

create type client_status      as enum ('Prospect', 'Active', 'On Hold', 'Closed');
create type cmmc_path           as enum ('Level 1', 'Level 2', 'Level 3', 'Undetermined');
create type readiness_phase     as enum (
  'Intake', 'Scoping', 'Assessment', 'Remediation', 'SSP', 'POA&M', 'Audit Prep', 'Maintained'
);

create type readiness_status    as enum ('Met', 'Partial', 'Not Met', 'Not Reviewed', 'Not Applicable');
create type implementation_status as enum ('Not Started', 'In Progress', 'Implemented', 'Not Applicable');
create type ssp_status           as enum ('Complete', 'Needs Fix', 'Missing', 'Mismatch', 'Not Reviewed');
create type evidence_status      as enum (
  'Not Requested', 'Requested', 'Uploaded', 'In Review', 'Accepted',
  'Needs Revision', 'Rejected', 'Missing', 'Expired'
);
create type evidence_quality     as enum ('Strong', 'Acceptable', 'Weak', 'Missing', 'Not Relevant', 'Outdated');
create type evidence_freshness   as enum ('Current', 'Expired', 'N/A');
create type ssp_support          as enum ('Yes', 'Partial', 'No');
create type poam_status          as enum ('None', 'Not Started', 'Ongoing', 'Blocked', 'Complete', 'Validated', 'Closed');
create type poam_class           as enum ('Blocker', 'Readiness', 'Internal');
create type task_status          as enum ('Not Started', 'In Progress', 'Blocked', 'Done');
create type cmmc_level           as enum ('L1', 'L2');
create type score_source         as enum ('placeholder', 'official');

-- ============================================================================
-- ORGANIZATIONS  &  TENANCY
-- ============================================================================

-- The owning Benchmark Fox organization (and any future tenant orgs).
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  is_internal boolean not null default true,  -- true = Benchmark Fox itself
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Clients = engagements that Benchmark Fox manages. Soft-deletable.
create table clients (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  name            text not null,
  status          client_status not null default 'Prospect',
  cmmc_path       cmmc_path not null default 'Undetermined',
  cmmc_level      cmmc_level,                       -- target level once known
  risk_rating     risk_level,
  readiness_phase readiness_phase not null default 'Intake',
  -- assigned Benchmark Fox staff (denormalized convenience; authoritative
  -- mapping is client_assignments below)
  primary_consultant_id   uuid,  -- FK added after profiles exists
  secondary_consultant_id uuid,
  deadline        date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz                       -- soft delete
);
create index clients_org_idx     on clients(organization_id) where deleted_at is null;
create index clients_status_idx  on clients(status)          where deleted_at is null;

-- ============================================================================
-- USERS / PROFILES / ROLES / ASSIGNMENTS
-- ============================================================================

-- Application profile, 1:1 with Supabase auth.users.
-- NOTE: the auth.users FK is commented out so this migration can be applied in a
-- bare Postgres (CI / local) without the Supabase auth schema. Uncomment when
-- running against a real Supabase project.
create table profiles (
  id              uuid primary key default gen_random_uuid(),
  -- user_id      uuid unique references auth.users(id) on delete cascade,
  user_id         uuid unique,                      -- = auth.users.id on Supabase
  organization_id uuid references organizations(id) on delete set null,
  full_name       text not null,
  email           text unique not null,
  status          text not null default 'Active'    -- Active | Invited | Disabled
                    check (status in ('Active', 'Invited', 'Disabled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index profiles_org_idx on profiles(organization_id);

-- A profile may hold multiple roles (e.g. admin + consultant).
create table user_roles (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  role       app_role not null,
  created_at timestamptz not null default now(),
  unique (profile_id, role)
);

-- Which Benchmark Fox (or, later, client) user works which client, and how.
create table client_assignments (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id)  on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  role         app_role not null,                    -- role *for this client*
  is_primary   boolean not null default false,       -- primary consultant flag
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (client_id, profile_id)
);
create index client_assignments_client_idx  on client_assignments(client_id);
create index client_assignments_profile_idx on client_assignments(profile_id);

-- Now that profiles exists, wire up the convenience consultant FKs on clients.
alter table clients
  add constraint clients_primary_consultant_fk
    foreign key (primary_consultant_id)   references profiles(id) on delete set null,
  add constraint clients_secondary_consultant_fk
    foreign key (secondary_consultant_id) references profiles(id) on delete set null;

-- ============================================================================
-- CONTROL LIBRARY  (global reference data — shared across all clients)
-- ============================================================================

-- The 14 NIST SP 800-171 Rev. 2 families.
create table control_families (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,   -- 'AC'
  name        text not null,          -- 'Access Control'
  section     text not null,          -- '3.1'
  family_index text not null,         -- '1'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The 110 NIST SP 800-171 Rev. 2 controls. natural_id mirrors the app's '3.1.1'.
create table controls (
  id            uuid primary key default gen_random_uuid(),
  natural_id    text unique not null,  -- '3.1.1'  (= Control.id / Control.number)
  code          text not null,         -- 'AC.L1-3.1.1'
  family_id     uuid not null references control_families(id) on delete restrict,
  level         cmmc_level not null,   -- 'L1' | 'L2'
  title         text not null,
  summary       text not null,
  requirement   text not null,         -- verbatim NIST 800-171 Rev. 2 text
  explanation   text,                  -- BF plain-English ('' / null = TODO)
  -- SPRS deduction weight. NULL = NOT FINALIZED (DoD Assessment Methodology not
  -- bundled); must not be guessed. See score_source.
  score_value   integer,
  score_source  score_source not null default 'placeholder',
  ssp_guidance  text,
  poam_guidance text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index controls_family_idx on controls(family_id);

-- Official + Benchmark Fox source-document registry.
create table source_references (
  id            uuid primary key default gen_random_uuid(),
  source_id     text unique not null,  -- 'nist-sp-800-171r2'  (app sourceId)
  source_name   text not null,
  publisher     text not null,
  document_type text not null,
  version       text,
  url           text,
  reference     text,                  -- section / page / clause
  is_official   boolean not null default true,  -- false = Benchmark Fox internal
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- control ↔ source mapping (many-to-many).
create table control_source_references (
  id          uuid primary key default gen_random_uuid(),
  control_id  uuid not null references controls(id)           on delete cascade,
  source_id   uuid not null references source_references(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  unique (control_id, source_id)
);

-- ============================================================================
-- PER-CLIENT WORKFLOW DATA
-- ============================================================================

-- Per-client assessment of a control. UNIQUE on (client_id, control_id).
create table client_control_assessments (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references clients(id)  on delete cascade,
  control_id           uuid not null references controls(id) on delete restrict,
  readiness_status     readiness_status      not null default 'Not Reviewed',
  implementation_status implementation_status not null default 'Not Started',
  ssp_status           ssp_status            not null default 'Not Reviewed',
  evidence_status      evidence_status       not null default 'Not Requested',
  poam_status          poam_status           not null default 'None',
  risk_rating          risk_level,
  owner_name           text,
  due_date             date,
  score_impact         integer,           -- points at risk for this client/control
  consultant_notes     text,
  client_notes         text,
  validation_method    text,              -- Examine | Interview | Test (800-171A)
  last_reviewed_at     timestamptz,
  reviewed_by          uuid references profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (client_id, control_id)
);
create index cca_client_idx  on client_control_assessments(client_id);
create index cca_control_idx on client_control_assessments(control_id);

-- Guided intake summary per client. Soft-deletable.
create table intake_records (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references clients(id) on delete cascade,
  likely_cmmc_path      text,
  estimated_scope       text,
  likely_data_type      text,
  initial_risk_rating   text,
  recommended_next_step text,
  proposed_engagement   text,
  contract_clauses      jsonb not null default '[]'::jsonb,  -- [{label, selected}]
  data_handling_types   jsonb not null default '[]'::jsonb,  -- [{label, selected}]
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
create index intake_client_idx on intake_records(client_id) where deleted_at is null;

-- Scoping summary per client. Soft-deletable.
create table scope_records (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references clients(id) on delete cascade,
  assessment_boundary text,
  cui_strategy        text,
  msp_esp_involved    text,     -- 'Yes' | 'No' | free text
  cloud_services      text,
  scope_notes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index scope_client_idx on scope_records(client_id) where deleted_at is null;

-- Asset inventory under a scope record. Soft-deletable.
create table scope_assets (
  id              uuid primary key default gen_random_uuid(),
  scope_record_id uuid not null references scope_records(id) on delete cascade,
  asset_name      text not null,
  asset_type      text,            -- Cloud | Endpoint | Network | ...
  asset_category  text,            -- CUI Asset | Security Protection | ...
  handles_cui     boolean not null default false,
  in_scope        boolean not null default true,
  owner_name      text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index scope_assets_record_idx on scope_assets(scope_record_id) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- EVIDENCE  — METADATA + SECURE LINKS ONLY.  Soft-deletable.
-- ----------------------------------------------------------------------------
-- !!  DO NOT store CUI or sensitive evidence FILES directly in this MVP        !!
-- !!  database. Store METADATA and approved SECURE EXTERNAL LINKS only.        !!
-- There is intentionally NO file/bytea/blob column. The actual artifact lives
-- in the client's own secure store (e.g. GCC High / SharePoint); external_link
-- points at it and storage_location_note describes where it is.
-- ----------------------------------------------------------------------------
create table evidence_items (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references clients(id)  on delete cascade,
  control_id            uuid references controls(id)          on delete set null,
  title                 text not null,
  evidence_type         text,                  -- Policy | Screenshot | Config | ...
  status                evidence_status  not null default 'Not Requested',
  quality               evidence_quality,
  owner_name            text,
  external_link         text,                  -- approved secure link (NOT a file)
  storage_location_note text,                  -- where the artifact actually lives
  uploaded_by           uuid references profiles(id) on delete set null,
  reviewed_by           uuid references profiles(id) on delete set null,
  uploaded_at           timestamptz,
  reviewed_at           timestamptz,
  evidence_date         date,                  -- date the evidence reflects
  freshness_status      evidence_freshness not null default 'N/A',
  supports_ssp          ssp_support,
  related_poam_id       uuid,                  -- FK added after poam_items
  related_task_id       uuid,                  -- FK added after tasks
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
create index evidence_client_idx  on evidence_items(client_id)  where deleted_at is null;
create index evidence_control_idx on evidence_items(control_id) where deleted_at is null;

comment on table evidence_items is
  'Evidence METADATA + secure external links ONLY. MVP rule: never store CUI or '
  'sensitive evidence files in this database. No file column exists by design.';

-- ----------------------------------------------------------------------------
-- POA&M  — aligns to the app + POA&M template fields. Soft-deletable.
-- ----------------------------------------------------------------------------
create table poam_items (
  id                          uuid primary key default gen_random_uuid(),
  client_id                   uuid not null references clients(id)  on delete cascade,
  control_id                  uuid references controls(id)          on delete set null,
  weakness                    text not null,
  responsible_owner           text,
  responsible_office          text,
  resource_estimate           text,
  scheduled_completion_date   date,
  milestones                  jsonb not null default '[]'::jsonb,  -- [{label,date,done}]
  changes_to_milestones       text,
  how_identified              text,
  status                      poam_status not null default 'Not Started',
  classification              poam_class  not null default 'Readiness',
  risk_rating                 risk_level,
  evidence_required_for_closure text,
  closure_notes               text,
  validated_at                timestamptz,
  validated_by                uuid references profiles(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz
);
create index poam_client_idx  on poam_items(client_id)  where deleted_at is null;
create index poam_control_idx on poam_items(control_id) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- TASKS  — remediation work items. Soft-deletable.
-- ----------------------------------------------------------------------------
create table tasks (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references clients(id) on delete cascade,
  title               text not null,
  description         text,
  owner_name          text,
  priority            risk_level not null default 'Medium',
  due_date            date,
  status              task_status not null default 'Not Started',
  related_control_id  uuid references controls(id)        on delete set null,
  related_poam_id     uuid references poam_items(id)      on delete set null,
  related_evidence_id uuid references evidence_items(id)  on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index tasks_client_idx on tasks(client_id) where deleted_at is null;

-- Backfill the deferred evidence ↔ poam / task relationship FKs.
alter table evidence_items
  add constraint evidence_related_poam_fk
    foreign key (related_poam_id) references poam_items(id) on delete set null,
  add constraint evidence_related_task_fk
    foreign key (related_task_id) references tasks(id)      on delete set null;

-- ----------------------------------------------------------------------------
-- REPORTS  — report METADATA only (NOT the rendered, possibly CUI-bearing
-- artifact). Soft-deletable.
-- ----------------------------------------------------------------------------
create table reports (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  title         text not null,
  report_type   text,                 -- Readiness Summary | SSP | POA&M | ...
  description   text,
  parameters    jsonb not null default '{}'::jsonb,  -- generation inputs
  external_link text,                  -- secure link to the rendered artifact
  generated_at  timestamptz,
  generated_by  uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index reports_client_idx on reports(client_id) where deleted_at is null;

comment on table reports is
  'Report METADATA only. The rendered artifact (which may embed CUI) is not '
  'stored here; external_link points to it in the client''s secure store.';

-- ============================================================================
-- AUDIT EVENTS  — append-only accountability trail.
-- Audit logs are essential for ACCOUNTABILITY and CLIENT TRUST: a CMMC
-- readiness engagement must be able to show who changed what, and when.
-- Not soft-deletable; application roles get no UPDATE/DELETE (see rls_plan.sql).
-- ============================================================================
create table audit_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  client_id       uuid references clients(id)       on delete set null,
  user_id         uuid references profiles(id)      on delete set null,
  action          text not null,        -- 'assessment.update', 'evidence.review', ...
  entity_type     text,                 -- 'client_control_assessment', 'poam_item', ...
  entity_id       uuid,
  old_value       jsonb,
  new_value       jsonb,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);
create index audit_client_idx  on audit_events(client_id);
create index audit_user_idx    on audit_events(user_id);
create index audit_created_idx on audit_events(created_at);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create trigger trg_organizations_updated  before update on organizations             for each row execute function set_updated_at();
create trigger trg_clients_updated         before update on clients                   for each row execute function set_updated_at();
create trigger trg_profiles_updated        before update on profiles                  for each row execute function set_updated_at();
create trigger trg_client_assign_updated   before update on client_assignments        for each row execute function set_updated_at();
create trigger trg_control_families_updated before update on control_families         for each row execute function set_updated_at();
create trigger trg_controls_updated        before update on controls                  for each row execute function set_updated_at();
create trigger trg_source_refs_updated     before update on source_references         for each row execute function set_updated_at();
create trigger trg_cca_updated             before update on client_control_assessments for each row execute function set_updated_at();
create trigger trg_intake_updated          before update on intake_records            for each row execute function set_updated_at();
create trigger trg_scope_updated           before update on scope_records             for each row execute function set_updated_at();
create trigger trg_scope_assets_updated    before update on scope_assets              for each row execute function set_updated_at();
create trigger trg_evidence_updated        before update on evidence_items            for each row execute function set_updated_at();
create trigger trg_poam_updated            before update on poam_items                for each row execute function set_updated_at();
create trigger trg_tasks_updated           before update on tasks                     for each row execute function set_updated_at();
create trigger trg_reports_updated         before update on reports                   for each row execute function set_updated_at();

-- ============================================================================
-- Row Level Security: ENABLE here; draft POLICIES live in
-- supabase/policies/rls_plan.sql (kept separate so the access model is reviewed
-- as one document and not buried in the schema).
-- ============================================================================
alter table organizations              enable row level security;
alter table clients                    enable row level security;
alter table profiles                   enable row level security;
alter table user_roles                 enable row level security;
alter table client_assignments         enable row level security;
alter table control_families           enable row level security;
alter table controls                   enable row level security;
alter table source_references          enable row level security;
alter table control_source_references  enable row level security;
alter table client_control_assessments enable row level security;
alter table intake_records             enable row level security;
alter table scope_records              enable row level security;
alter table scope_assets               enable row level security;
alter table evidence_items             enable row level security;
alter table poam_items                 enable row level security;
alter table tasks                      enable row level security;
alter table reports                    enable row level security;
alter table audit_events               enable row level security;

commit;
