/* ============================================================================
   BackendStatusCard — shows the current backend mode + reference-data status.

   Reads everything through the useReferenceData hook and backendConfig (never
   Supabase directly). Safe in both modes:
     * Local prototype mode — shows local counts + an explanatory message.
     * Supabase reference-read mode — shows whether data came from Supabase or
       fell back to local, plus any error.
   ============================================================================ */
import type { ReactNode } from 'react';
import { Badge, Card } from './primitives';
import { getBackendStatus } from '../lib/backendConfig';
import { useReferenceData } from '../hooks/useReferenceData';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      className="between"
      style={{ padding: '7px 0', borderBottom: '1px solid var(--line-soft)' }}
    >
      <span className="muted" style={{ fontSize: '.9em' }}>
        {label}
      </span>
      <span style={{ fontSize: '.9em' }}>{children}</span>
    </div>
  );
}

export function BackendStatusCard() {
  const status = getBackendStatus();
  const { data, loading, error, source, health } = useReferenceData();

  const counts = health?.counts ?? {
    families: data.families.length,
    controls: data.controls.length,
    sourceReferences: data.sourceReferences.length,
    controlSourceReferences: data.controlSourceReferences.length,
  };
  const lastChecked = health?.lastChecked
    ? new Date(health.lastChecked).toLocaleString()
    : '—';
  const fromSupabase = source === 'supabase';

  return (
    <Card title="Backend Status">
      <div className="grid-2" style={{ gap: '0 var(--gap)' }}>
        <Row label="Backend mode">
          <Badge tone={status.supabaseConfigured ? 'ok' : 'none'}>{status.modeLabel}</Badge>
        </Row>
        <Row label="Supabase configured">
          <Badge tone={status.supabaseConfigured ? 'ok' : 'bad'}>
            {status.supabaseConfigured ? 'Yes' : 'No'}
          </Badge>
        </Row>
        <Row label="Reference data source">
          {loading ? (
            <Badge tone="warn">Loading…</Badge>
          ) : (
            <Badge tone={fromSupabase ? 'ok' : 'none'}>
              {fromSupabase ? 'Supabase' : 'Local fallback'}
            </Badge>
          )}
        </Row>
        <Row label="Last checked">
          <span className="mono faint">{lastChecked}</span>
        </Row>
        <Row label="Control families loaded">
          <span className="mono">{counts.families}</span>
        </Row>
        <Row label="Controls loaded">
          <span className="mono">{counts.controls}</span>
        </Row>
        <Row label="Source references loaded">
          <span className="mono">{counts.sourceReferences}</span>
        </Row>
        <Row label="Control/source mappings loaded">
          <span className="mono">{counts.controlSourceReferences}</span>
        </Row>
      </div>

      {error && (
        <div
          className="annot"
          style={{ marginTop: 10, color: 'var(--bad, #b4232a)' }}
        >
          Supabase read failed — using local fallback. {error}
        </div>
      )}

      {!status.supabaseConfigured && (
        <p className="muted" style={{ marginTop: 12, fontSize: '.88em' }}>
          {status.description}
        </p>
      )}

      <p className="annot" style={{ marginTop: 12 }}>
        Read-only reference data this phase — no client writes, no CUI, no evidence
        files stored in Supabase. Client edits remain in localStorage.
      </p>
    </Card>
  );
}
