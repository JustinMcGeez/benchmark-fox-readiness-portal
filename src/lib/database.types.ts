/* ============================================================================
   Supabase database types — PLACEHOLDER / STUB.

   This is a hand-written stub so `supabaseClient.ts` is fully typed today. It is
   NOT the authoritative generated file. The real, exhaustive types should be
   generated from the live schema with the Supabase CLI:

     # 1. Log in and link the project (once):
     npx supabase login
     npx supabase link --project-ref <your-project-ref>

     # 2. Generate types from the linked remote schema:
     npx supabase gen types typescript --linked > src/lib/database.types.ts

     # ...or from a local stack:
     npx supabase gen types typescript --local  > src/lib/database.types.ts

   Regenerate after every migration so this file always matches
   supabase/migrations/. Until then, this stub only models a representative
   subset of tables/enums (enough to compile against) and uses an index
   signature so referencing not-yet-modeled tables does not break the build.

   Source of truth for the schema: supabase/migrations/001_initial_schema.sql
   ============================================================================ */

/** Generic Supabase JSON column type. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/* ---- enums (mirror the Postgres enum types in 001_initial_schema.sql) ---- */
export type RiskLevelEnum = 'Low' | 'Medium' | 'High' | 'Critical';
export type AppRoleEnum =
  | 'benchmark_fox_admin'
  | 'benchmark_fox_consultant'
  | 'client_executive'
  | 'client_it_owner'
  | 'evidence_uploader'
  | 'readonly_viewer';
export type ReadinessStatusEnum = 'Met' | 'Partial' | 'Not Met' | 'Not Reviewed' | 'Not Applicable';
export type SspStatusEnum = 'Complete' | 'Needs Fix' | 'Missing' | 'Mismatch' | 'Not Reviewed';
export type EvidenceStatusEnum =
  | 'Not Requested'
  | 'Requested'
  | 'Uploaded'
  | 'In Review'
  | 'Accepted'
  | 'Needs Revision'
  | 'Rejected'
  | 'Missing'
  | 'Expired';
export type PoamStatusEnum =
  | 'None'
  | 'Not Started'
  | 'Ongoing'
  | 'Blocked'
  | 'Complete'
  | 'Validated'
  | 'Closed';

/** Convenience shape shared by a generated table: Row/Insert/Update. */
interface TableShape<Row> {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
}

/**
 * Representative subset of the schema. This is intentionally partial — the
 * `[table: string]` index signature lets the typed client reference tables that
 * are not modeled here yet, without compile errors, until the generated file
 * replaces this stub.
 */
export interface Database {
  public: {
    Tables: {
      profiles: TableShape<{
        id: string;
        user_id: string | null;
        organization_id: string | null;
        full_name: string;
        email: string;
        /** Single primary app role — added by 002_auth_profiles.sql. */
        role: AppRoleEnum;
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      clients: TableShape<{
        id: string;
        organization_id: string;
        name: string;
        status: string;
        cmmc_path: string;
        cmmc_level: string | null;
        risk_rating: RiskLevelEnum | null;
        readiness_phase: string;
        primary_consultant_id: string | null;
        secondary_consultant_id: string | null;
        deadline: string | null;
        notes: string | null;
        /** Added by 006_client_profile_fields.sql. */
        cage_code: string | null;
        dib_role: string | null;
        contract_types: Json;
        primary_contact_name: string | null;
        primary_contact_email: string | null;
        primary_contact_title: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      client_assignments: TableShape<{
        id: string;
        client_id: string;
        profile_id: string;
        role: AppRoleEnum;
        is_primary: boolean;
        created_at: string;
        updated_at: string;
        /** Added by 006_client_profile_fields.sql (soft-delete). */
        deleted_at: string | null;
      }>;
      client_control_assessments: TableShape<{
        id: string;
        client_id: string;
        control_id: string;
        readiness_status: ReadinessStatusEnum;
        implementation_status: string;
        ssp_status: SspStatusEnum;
        evidence_status: EvidenceStatusEnum;
        poam_status: PoamStatusEnum;
        risk_rating: RiskLevelEnum | null;
        owner_name: string | null;
        due_date: string | null;
        score_impact: number | null;
        consultant_notes: string | null;
        client_notes: string | null;
        validation_method: string | null;
        /** Added by 003_assessment_ssp_statement.sql. */
        ssp_statement: string | null;
        last_reviewed_at: string | null;
        reviewed_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      controls: TableShape<{
        id: string;
        natural_id: string;
        code: string;
        family_id: string;
        level: string;
        title: string;
        summary: string;
        requirement: string;
        explanation: string | null;
        score_value: number | null;
        score_source: string;
        ssp_guidance: string | null;
        poam_guidance: string | null;
        created_at: string;
        updated_at: string;
      }>;
      intake_records: TableShape<{
        id: string;
        client_id: string;
        system_name: string | null;
        likely_cmmc_path: string | null;
        estimated_scope: string | null;
        likely_data_type: string | null;
        initial_risk_rating: string | null;
        recommended_next_step: string | null;
        proposed_engagement: string | null;
        contract_clauses: Json;
        data_handling_types: Json;
        notes: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      scope_records: TableShape<{
        id: string;
        client_id: string;
        assessment_boundary: string | null;
        cui_strategy: string | null;
        msp_esp_involved: string | null;
        cloud_services: string | null;
        scope_notes: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      scope_assets: TableShape<{
        id: string;
        scope_record_id: string;
        asset_name: string;
        asset_type: string | null;
        asset_category: string | null;
        handles_cui: boolean;
        in_scope: boolean;
        owner_name: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      evidence_items: TableShape<{
        id: string;
        client_id: string;
        control_id: string | null;
        title: string;
        evidence_type: string | null;
        status: EvidenceStatusEnum;
        quality: string | null;
        owner_name: string | null;
        external_link: string | null;
        storage_location_note: string | null;
        uploaded_by: string | null;
        reviewed_by: string | null;
        uploaded_at: string | null;
        reviewed_at: string | null;
        evidence_date: string | null;
        freshness_status: string;
        supports_ssp: string | null;
        related_poam_id: string | null;
        related_task_id: string | null;
        notes: string | null;
        /** Added by 007_evidence_workflow.sql. */
        objective_ids: Json;
        description: string | null;
        due_date: string | null;
        expires_on: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      audit_events: TableShape<{
        id: string;
        organization_id: string | null;
        client_id: string | null;
        user_id: string | null;
        action: string;
        entity_type: string | null;
        entity_id: string | null;
        old_value: Json | null;
        new_value: Json | null;
        actor_name: string | null; // added by migration 005 (denormalized actor)
        ip_address: string | null;
        user_agent: string | null;
        created_at: string;
      }>;
      // Other tables (organizations, user_roles, client_assignments,
      // control_families, source_references, control_source_references,
      // poam_items, tasks, reports) are defined in the migrations and will appear
      // here once `supabase gen types typescript` is run. Until then the index
      // signature below keeps the build green.
      [table: string]: TableShape<Record<string, unknown>>;
    };
    Views: { [view: string]: never };
    Functions: { [fn: string]: never };
    Enums: {
      risk_level: RiskLevelEnum;
      app_role: AppRoleEnum;
      readiness_status: ReadinessStatusEnum;
      evidence_status: EvidenceStatusEnum;
      poam_status: PoamStatusEnum;
    };
    CompositeTypes: { [type: string]: never };
  };
}
