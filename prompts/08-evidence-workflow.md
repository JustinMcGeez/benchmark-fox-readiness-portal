# Task 08 — Evidence lifecycle workflow

> Repo-wide rules live in CLAUDE.md and apply on top of everything below.

TASK: Turn the Evidence Hub from a static list into the working evidence
workflow a consultant runs with a client. METADATA + EXTERNAL LINKS ONLY — this
constraint is absolute. There is no file upload in this product by design; do
not add one, do not add Supabase Storage.

CONTEXT: evidence statuses already exist in types.ts / the DB enum:
Not Requested, Requested, Uploaded, In Review, Accepted, Needs Revision,
Rejected, Missing, Expired. evidence_items maps to a control and optional
800-171A objectiveIds, with quality + freshness fields.

1. Repository: EvidenceRepository with list(clientId), create, update, and an
   explicit transition(evidenceId, toStatus, note) method. Encode the legal
   state machine in ONE place (src/lib/evidenceWorkflow.ts) as a transition map:
     Not Requested → Requested
     Requested → Uploaded | Missing
     Uploaded → In Review
     In Review → Accepted | Needs Revision | Rejected
     Needs Revision → Uploaded
     Accepted → Expired (time-based or manual)
     Expired → Requested
   transition() rejects illegal moves with a typed error. Every transition
   writes an audit event (Prompt 6 triggers cover row updates; add the human
   note to the row).
2. Evidence Hub screen upgrades (keep existing styling):
   - Status-driven board or grouped table (keep the current table layout,
     grouped by status) with counts per status.
   - "Request evidence" flow: pick control → pick specific 800-171A objectives
     (or whole control) → describe what's needed → assignee → due date. Creates
     a Requested item.
   - Item detail drawer: external_link field (validate https:// URL; show the
     standing warning that the artifact stays in the client's secure store),
     quality (Strong/Acceptable/Weak…), freshness with an expiry date that
     auto-flags Expired via a derived check (computed at read time — no cron),
     reviewer notes, and the legal next-status buttons ONLY (driven by the
     transition map, never free-form status dropdown).
   - Objective coverage: per control, show n/m objectives with Accepted
     evidence; surface "controls with zero accepted evidence" as a filter.
3. Flow-through: Control Detail's evidence section, SSP Workspace's coverage
   indicator, Reports' evidence summaries, and lib/selectors.ts missing/weak
   evidence counts must all consume the SAME selectors — refactor to one source
   of truth in selectors.ts, delete any per-screen duplication you find (list
   what you deleted).
4. Permissions: evidence_uploader can create/update items + set links for
   assigned clients but the review transitions (In Review → Accepted/Needs
   Revision/Rejected) are consultant/admin only — enforce in RLS (extend Prompt
   5 policies with a column-level or transition guard via a SECURITY DEFINER
   RPC if needed; explain your approach) AND hide in UI.
5. Tests: exhaustive unit tests of the transition map (every legal move passes,
   a sample of illegal moves rejects), expiry derivation, objective coverage
   math; e2e (local mode): request → link added → review → accept, watch the
   control's evidence status update in the matrix.

ACCEPTANCE: a full request→accept cycle works end to end and is visible in the
audit log; no file bytes are ever stored anywhere; coverage numbers agree across
all four screens.
