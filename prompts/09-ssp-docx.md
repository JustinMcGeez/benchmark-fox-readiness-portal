# Task 09 — SSP document generator (.docx)

> Repo-wide rules live in CLAUDE.md and apply on top of everything below.

TASK: Generate a real System Security Plan as a .docx from the app's data. This
is a primary client deliverable for Benchmark Fox — output quality matters more
than code elegance.

AUTHORIZED NEW DEPENDENCY: docx (the npm package "docx", client-side generation)
+ file-saver. No server-side rendering, no Supabase storage of the artifact —
the file is generated in the browser and downloaded; it is the CLIENT'S document.

STRUCTURE (follow NIST SP 800-171 SSP expectations; the app already cites the
official sources in sourceRefs.ts — reference them):
1. Cover page: client name, "System Security Plan", system name (new field on
   client/scope if missing — add it via migration + intake field), CMMC target
   level, version + date, "Prepared with Benchmark Fox", and the standing
   disclaimer (readiness support ≠ certification — reuse the existing disclaimer
   text constants, do not rewrite them).
2. Section 1 System Identification: from intake + scope data (system
   description, environment, CUI data flows as described in scope).
3. Section 2 System Environment: the scope asset inventory table (asset, type,
   in/out of scope, notes).
4. Section 3 Requirements: one subsection per control, grouped by the 14
   families, for ALL 110 controls in numeric order:
   - Control number + official requirement text (verbatim from the generated
     library — never paraphrased).
   - Implementation status (Met/Partial/Not Met/NA/Not Reviewed).
   - Implementation statement: the sspStatement field if authored; otherwise an
     explicit "[IMPLEMENTATION STATEMENT REQUIRED]" placeholder in red — a
     half-finished SSP must be visibly half-finished, never silently blank.
   - If status is Not Met/Partial: reference to the related POA&M item id(s).
5. Appendix A: estimated SPRS score with the standard estimate disclaimer and
   methodology citation (DoD AM v1.2.1). Appendix B: evidence index (metadata +
   objective coverage; links listed as references, clearly marked as held in the
   client's own repository).

IMPLEMENTATION
- src/lib/export/sspDocx.ts: pure function (data in → Blob out), fully unit-
  testable without the DOM where possible. All paragraph/table builders typed.
- Styling: Montserrat headings / readable body, navy heading color, proper
  Word heading levels (so the doc has a working TOC — include an auto TOC
  field), page numbers, footer with client name + CONFIDENTIAL marking, tables
  with repeated header rows.
- Trigger from the SSP Workspace and the Reports screen: "Generate SSP (.docx)".
  Show pre-flight summary first: X controls with statements, Y placeholders,
  Z not reviewed — with a "Generate anyway" confirm.
- Write an audit event 'report.ssp_generated' (metadata only, no file).
- Performance: 110 sections must generate in < 3s on a mid laptop; build content
  arrays, don't deep-clone per control.

TESTS: unit tests asserting the generated document model contains 110 control
sections, official text matches the library verbatim for a sample (3.1.1,
3.12.4, 3.13.11), placeholders appear for missing statements, and POA&M
references resolve. (Test the docx package's document tree, not rendered bytes.)

ACCEPTANCE: generated file opens cleanly in Microsoft Word AND LibreOffice with
working TOC; a control with an authored statement and one without both render
correctly; no official text is altered.
