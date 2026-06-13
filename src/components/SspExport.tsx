/* ============================================================================
   SSP export UI — the "Generate SSP (.docx)" trigger shared by the SSP
   Workspace and the Reports screen. Opens a pre-flight summary (how many
   controls have authored statements, how many are placeholders, how many are
   not reviewed) so a half-finished SSP is generated only on an explicit
   "Generate anyway".

   The document is generated CLIENT-SIDE and downloaded — it is the client's
   file. We only write a metadata-only 'report.ssp_generated' audit event; no
   artifact is ever stored by this product.
   ============================================================================ */
import { useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
import { Btn } from './primitives';
import { useData } from '../data/store';
import { useReference } from '../data/referenceStore';
import { useCurrentClient } from '../data/clientsStore';
import { POAM_ITEMS } from '../data/poam';
import { logEvent } from '../lib/audit';
import { buildSspModel, type SspInput } from '../lib/export/sspModel';
// NOTE: the docx renderer (sspDocx) is heavy (~0.5 MB) and is loaded lazily on
// generate — the pre-flight summary needs only the docx-free model above.

const SSP_VERSION = '1.0';

/** Assemble the SSP input from the current client-scoped stores. */
function useSspInput(): { input: SspInput; clientId: string } {
  const { assessments, evidence, intake, scope, currentClientId } = useData();
  const { controls } = useReference();
  const client = useCurrentClient();

  const input = useMemo<SspInput>(
    () => ({
      clientName: client?.name ?? 'Client',
      systemName: intake.systemName,
      cmmcTarget: client?.cmmcPath ?? intake.likelyPath ?? 'Undetermined',
      intake,
      scope,
      assessments,
      controls,
      evidence,
      poam: POAM_ITEMS.filter((p) => p.clientId === currentClientId),
      version: SSP_VERSION,
    }),
    [client, intake, scope, assessments, controls, evidence, currentClientId],
  );

  return { input, clientId: currentClientId };
}

/** Pre-flight dialog + the actual generate/download. Mounted only while open. */
function SspExportDialog({ onClose }: { onClose: () => void }) {
  const { input, clientId } = useSspInput();
  const model = useMemo(() => buildSspModel(input), [input]);
  const { preflight } = model;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      // Lazy-load the docx renderer so the heavy library stays out of the main bundle.
      const { generateSspBlob } = await import('../lib/export/sspDocx');
      const { blob, filename } = await generateSspBlob(input);
      saveAs(blob, filename);
      // Metadata-only audit event (no-op in Local Prototype mode). Never blocks.
      void logEvent('report.ssp_generated', { clientId });
      onClose();
    } catch {
      setError('Could not generate the SSP document. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div
      onClick={busy ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Generate SSP"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1001,
        background: 'rgba(30,28,24,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-card"
        style={{ width: 'min(540px, 96vw)', maxHeight: '88vh', overflow: 'auto', padding: 24 }}
      >
        <div className="between" style={{ marginBottom: 14 }}>
          <h2 className="w-h2">Generate SSP (.docx)</h2>
          <Btn onClick={onClose} disabled={busy}>
            ✕ Close
          </Btn>
        </div>

        <p className="muted" style={{ margin: '0 0 12px', fontSize: '.9em' }}>
          {model.meta.clientName} · {model.meta.cmmcTarget}
          {!model.meta.systemNameProvided && (
            <>
              <br />
              <span style={{ color: 'var(--bad, #c0392b)' }}>
                No system name set — the cover page will show a placeholder. Add one on the Intake
                summary.
              </span>
            </>
          )}
        </p>

        <div className="grid-3" style={{ gap: 10 }}>
          <div className="w-box" style={{ padding: 12, textAlign: 'center' }}>
            <div className="mono faint" style={{ fontSize: '.62em' }}>
              WITH STATEMENTS
            </div>
            <div className="w-h2">{preflight.withStatements}</div>
          </div>
          <div className="w-box" style={{ padding: 12, textAlign: 'center' }}>
            <div className="mono faint" style={{ fontSize: '.62em' }}>
              PLACEHOLDERS
            </div>
            <div className="w-h2">{preflight.placeholders}</div>
          </div>
          <div className="w-box" style={{ padding: 12, textAlign: 'center' }}>
            <div className="mono faint" style={{ fontSize: '.62em' }}>
              NOT REVIEWED
            </div>
            <div className="w-h2">{preflight.notReviewed}</div>
          </div>
        </div>

        <p className="annot" style={{ margin: '12px 0 0', fontSize: '.82em' }}>
          {preflight.placeholders > 0
            ? `${preflight.placeholders} of ${preflight.total} controls have no implementation statement — they will appear as a red “[IMPLEMENTATION STATEMENT REQUIRED]” placeholder in the document.`
            : `All ${preflight.total} controls have an authored implementation statement.`}{' '}
          The .docx is generated in your browser and downloaded; no file is stored.
        </p>

        {error && (
          <p className="annot" style={{ margin: '10px 0 0', color: 'var(--bad, #c0392b)' }}>
            {error}
          </p>
        )}

        <div className="row gap-sm mt" style={{ justifyContent: 'flex-end' }}>
          <Btn ghost onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn primary onClick={generate} disabled={busy}>
            {busy ? 'Generating…' : 'Generate anyway'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/** "Generate SSP (.docx)" button + its pre-flight dialog. */
export function GenerateSspButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn primary onClick={() => setOpen(true)}>
        Generate SSP (.docx)
      </Btn>
      {open && <SspExportDialog onClose={() => setOpen(false)} />}
    </>
  );
}
