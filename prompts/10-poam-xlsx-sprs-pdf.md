# Task 10 — POA&M export (.xlsx) + SPRS readiness report (.pdf)

> Repo-wide rules live in CLAUDE.md and apply on top of everything below.

TASK: Two more deliverables: a POA&M workbook in the structure assessors expect,
and a polished SPRS readiness summary PDF for executives.

AUTHORIZED NEW DEPENDENCIES: exceljs (NOT xlsx/SheetJS — exceljs has real
styling), and pdfmake OR @react-pdf/renderer (pick one, justify in your summary).
Client-side generation + download only, as with the SSP.

PART A — POA&M .xlsx (src/lib/export/poamXlsx.ts)
Model the columns on the DoD/eMASS-style POA&M template the DIB ecosystem uses:
  Item ID | Control # | Weakness description | Severity/Risk | Source of
  weakness (assessment/self) | Resources required | Scheduled completion date |
  Milestones (with dates) | Milestone changes | Status | Comments
- One row per open POA&M item, milestones as wrapped multi-line cells with
  dates; closed/validated items on a second sheet ("Closed").
- Third sheet "Score Impact": per open item, the associated control's SPRS
  deduction value and the projected score if remediated (reuse lib/scoring.ts —
  do NOT reimplement scoring math in the exporter; export a helper from
  scoring.ts if needed).
- Header row styled (navy fill, white bold), frozen, autofilter on; column
  widths set; dates as real date cells not strings.

PART B — SPRS readiness report .pdf (src/lib/export/sprsReportPdf.ts)
A 3–6 page executive document:
  1. Cover: client, date, estimated SPRS score (big), readiness %, target level.
  2. Methodology note: estimate per DoD AM v1.2.1, Partial counted as Not Met,
     3.12.4 handling — reuse the existing disclaimer constants verbatim.
  3. By-family bar summary (render the chart to the PDF natively via the chosen
     lib's primitives — no html2canvas screenshots).
  4. Top findings (lib/selectors.ts topFindings) and top score-recovery
     opportunities (largest deductions currently Not Met).
  5. Footer disclaimers on every page.

PART C — Wiring
- Reports screen: replace the placeholder deliverable rows with three live
  actions (SSP docx from Prompt 9, POA&M xlsx, SPRS pdf), each with the
  pre-flight summary pattern and an audit event.
- All three exporters share src/lib/export/common.ts for branding constants,
  disclaimer text, and filename convention:
  `{clientSlug}_{deliverable}_{YYYY-MM-DD}.{ext}`.

TESTS: unit tests for the xlsx sheet model (row counts match open/closed items,
score-impact math equals scoring.ts output) and the PDF document definition
(sections present, disclaimers present). Manual check matrix in your summary:
Excel + LibreOffice for xlsx; Acrobat + browser viewer for pdf.

ACCEPTANCE: all three deliverables generate from the demo client without errors;
numbers on the PDF match the dashboard exactly (same selectors, no drift).
