/* ============================================================
   Screens — work: SSP, POA&M, Evidence, Tasks
   Data-driven from the assessment store + evidence/poam/tasks seeds.
   ============================================================ */
import { Fragment, useMemo, useState } from 'react';
import type { ScreenProps } from '../types';
import {
  Badge,
  Btn,
  Card,
  Check,
  Field,
  InlineSelect,
  PageHead,
  Ph,
  RiskBadge,
  Select,
  StatCard,
  Status,
  Tabs,
  Toolbar,
  WarnBanner,
} from '../components/primitives';
import { useData } from '../data/store';
import { useReference } from '../data/referenceStore';
import { useAuth } from '../auth/AuthProvider';
import { useCurrentClient } from '../data/clientsStore';
import {
  controlEvidenceCoverage,
  controlIdsWithoutAcceptedEvidence,
  evidenceCountsByStatus,
} from '../lib/selectors';
import {
  allowedNextStatuses,
  effectiveFreshness,
  effectiveStatus,
} from '../lib/evidenceWorkflow';
import { POAM_ITEMS } from '../data/poam';
import { TASKS } from '../data/tasks';
import {
  EVIDENCE_OPTIONS,
  type ClientControlAssessment,
  type Control,
  type EvidenceItem,
  type EvidencePatch,
  type EvidenceQuality,
  type EvidenceRequestInput,
  type EvidenceStatus,
  type SspStatus,
} from '../data/types';
import { SourceRefs } from '../components/SourceRefs';
import { GenerateSspButton } from '../components/SspExport';

const EVIDENCE_QUALITY_OPTIONS: EvidenceQuality[] = [
  'Strong',
  'Acceptable',
  'Weak',
  'Outdated',
  'Not Relevant',
  'Missing',
];

/* Evidence review (the In Review → Accepted/Needs Revision/Rejected transitions)
   is consultant/admin only — hidden in the UI here and enforced server-side by
   migration 007. Local Prototype mode (no auth) allows it so demos work. */
function useCanReviewEvidence(): boolean {
  const { isConfigured, role } = useAuth();
  return !isConfigured || role === 'benchmark_fox_admin' || role === 'benchmark_fox_consultant';
}

const isHttpsLink = (v: string): boolean => /^https:\/\/\S+$/i.test(v.trim());

const SSP_FILTERS: { label: string; value: SspStatus | 'All' }[] = [
  { label: 'All', value: 'All' },
  { label: 'Complete', value: 'Complete' },
  { label: 'Needs Update', value: 'Needs Fix' },
  { label: 'Missing', value: 'Missing' },
  { label: 'Mismatch With Evidence', value: 'Mismatch' },
  { label: 'Not Reviewed', value: 'Not Reviewed' },
];

const implOf = (a: ClientControlAssessment) =>
  a.status === 'Met' || a.status === 'Partial' ? 'Implemented' : 'Not Implemented';
const evSupports = (a: ClientControlAssessment) =>
  a.evidenceStatus === 'Accepted' ? 'Yes' : a.evidenceStatus === 'Missing' || a.evidenceStatus === 'Not Requested' ? 'No' : 'Partial';

/* ---------- 12. SSP WORKSPACE ---------- */
export function SSPScreen({ go }: ScreenProps) {
  const { assessments, evidence, selectControl } = useData();
  // Control definitions (titles/families) from the reference-data provider.
  const { controlsById } = useReference();
  const currentClient = useCurrentClient();
  const [tab, setTab] = useState('Control Statements');
  const [filter, setFilter] = useState<SspStatus | 'All'>('All');

  const counts = useMemo(() => {
    const c = { Complete: 0, 'Needs Fix': 0, Missing: 0, Mismatch: 0, 'Not Reviewed': 0 } as Record<string, number>;
    for (const a of assessments) c[a.sspStatus] = (c[a.sspStatus] ?? 0) + 1;
    return c;
  }, [assessments]);

  const rows = assessments
    .filter((a) => filter === 'All' || a.sspStatus === filter)
    .slice(0, 14);
  // editable side panel follows the selected row; with no selection it defaults
  // to the first filtered row (no hard-coded control).
  const [editorId, setEditorId] = useState<string | null>(null);
  const editor = (editorId && assessments.find((a) => a.controlId === editorId)) || rows[0] || assessments[0];

  return (
    <div className="col">
      <PageHead
        title={`SSP Workspace — ${currentClient?.name ?? 'Client'}`}
        sub="Track SSP completeness, accuracy, and implementation statements."
        actions={
          <>
            <Btn onClick={() => go('reports')}>Reports</Btn>
            <GenerateSspButton />
          </>
        }
      />
      <div className="grid-4">
        <StatCard k="Complete" v={counts.Complete} d="statements" tone="ok" />
        <StatCard k="Needs Update" v={counts['Needs Fix']} tone="warn" />
        <StatCard k="Missing" v={counts.Missing} tone="bad" />
        <StatCard k="Not Reviewed" v={counts['Not Reviewed']} tone="warn" />
      </div>
      <Tabs items={['SSP Summary', 'Control Statements', 'Gaps', 'Export']} active={tab} onPick={setTab} />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card style={{ padding: '6px 6px' }}>
          <div className="row wrap gap-sm" style={{ padding: '8px 10px' }}>
            {SSP_FILTERS.map((f) => (
              <button
                key={f.label}
                className={'w-btn sm' + (filter === f.value ? ' primary' : ' ghost')}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <table className="w-table">
            <thead>
              <tr>
                <th>Control</th>
                <th>SSP Status</th>
                <th>Implementation</th>
                <th>Evidence?</th>
                <th title="NIST SP 800-171A objective coverage from evidence metadata">Objectives</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const c = controlsById[a.controlId];
                const cov = controlEvidenceCoverage(c, evidence);
                const covTone =
                  cov.status === 'addressed'
                    ? 'ok'
                    : cov.status === 'partial'
                      ? 'warn'
                      : cov.status === 'not-addressed'
                        ? 'bad'
                        : 'none';
                const covLabel =
                  cov.status === 'addressed'
                    ? 'Addressed'
                    : cov.status === 'partial'
                      ? 'Needs review'
                      : cov.status === 'not-addressed'
                        ? 'Not addressed'
                        : '—';
                return (
                <tr
                  key={a.controlId}
                  onClick={() => setEditorId(a.controlId)}
                  style={{ background: a.controlId === editor.controlId ? 'var(--surface-2)' : undefined }}
                >
                  <td className="mono">
                    {a.controlId}
                    {/* Title + family from reference data; falls back to ID only. */}
                    {c && (
                      <div className="muted" style={{ fontSize: '.78em', fontWeight: 400 }}>
                        {c.title} · {c.familyCode}
                      </div>
                    )}
                  </td>
                  <td>
                    <Status s={a.sspStatus} />
                  </td>
                  <td>
                    <Status s={implOf(a)} />
                  </td>
                  <td>
                    <Status s={evSupports(a)} />
                  </td>
                  <td>
                    <Badge tone={covTone}>
                      {cov.status === 'no-objectives' ? covLabel : `${covLabel} (${cov.coveredIds.length}/${cov.total})`}
                    </Badge>
                  </td>
                  <td>
                    <a
                      className="annot"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectControl(a.controlId);
                        go('control-detail');
                      }}
                    >
                      {a.sspStatus === 'Missing' ? 'Draft' : 'Edit'}
                    </a>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <Card title={`SSP Statement Editor — ${editor.controlId}`}>
          {/* Control context from reference data (title · family · summary). */}
          {controlsById[editor.controlId] && (
            <p className="muted" style={{ margin: '0 0 12px', fontSize: '.88em' }}>
              <strong>{controlsById[editor.controlId].title}</strong>{' '}
              · {controlsById[editor.controlId].familyName} ({controlsById[editor.controlId].familyCode})
              <br />
              {controlsById[editor.controlId].summary}
            </p>
          )}
          <p className="annot" style={{ margin: '0 0 8px' }}>
            A strong SSP statement should explain what is implemented, where it is implemented, who
            owns it, how it is enforced, and what evidence supports it.
          </p>
          <Field
            label="Current SSP Statement"
            area
            value={editor.sspStatement ?? ''}
            placeholder="Document how this control is implemented…"
            rows={5}
          />
          <div className="grid-3 mt">
            <Select label="COMPLETENESS" value={editor.sspStatus} />
            <Select label="ACCURACY" value="Accurate" />
            <Select label="EVIDENCE SUPPORTS" value={evSupports(editor)} />
          </div>
          <div className="w-field mt">
            <span className="w-label">BENCHMARK FOX SSP GUIDANCE</span>
            {/* Authored per-control guidance from the BF overlay (bracketed values
                like [identity provider] are client-fillable variables). */}
            <div className="w-box fill muted" style={{ padding: 12, fontSize: '.92em' }}>
              {controlsById[editor.controlId]?.sspGuidance ??
                'A strong SSP statement should explain what is implemented, where it is implemented, who owns it, how it is enforced, how often it is reviewed, and what evidence supports it.'}
            </div>
          </div>
          <div className="row gap-sm mt" style={{ justifyContent: 'flex-end' }}>
            <Btn primary>Save SSP Notes</Btn>
          </div>
        </Card>
      </div>
      <SourceRefs ids={['nist-sp-800-171r2', 'nist-sp-800-171a', 'bf-ssp-template']} />
    </div>
  );
}

/* ---------- 13. POA&M TRACKER ---------- */
export function POAMScreen({ go }: ScreenProps) {
  const { selectControl } = useData();
  const { controlsById } = useReference();
  const currentClient = useCurrentClient();
  // default to the first blocker, otherwise the first POA&M item
  const defaultPoam = POAM_ITEMS.find((p) => p.classification === 'Blocker') ?? POAM_ITEMS[0];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = (selectedId && POAM_ITEMS.find((p) => p.id === selectedId)) || defaultPoam;
  // Linked control definition from reference data (graceful fallback to ID only).
  const detailControl = controlsById[detail.controlId];

  return (
    <div className="col">
      <PageHead
        title={`POA&M Tracker — ${currentClient?.name ?? 'Client'}`}
        sub="Manage weaknesses, owners, milestones, and validation status."
        actions={<Btn primary>+ New POA&M Item</Btn>}
      />
      <Toolbar search="Search items…" filters={['Status', 'Risk', 'Owner', 'Due Date']} />
      <WarnBanner tone="bad">
        Items flagged <strong>Blocker</strong> may prevent certification readiness. Do not assume they
        are acceptable without further review.
      </WarnBanner>
      <Card style={{ padding: '6px 6px' }}>
        <table className="w-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Control</th>
              <th>Weakness</th>
              <th>Owner</th>
              <th>Risk</th>
              <th>Due</th>
              <th>Status</th>
              <th>Class</th>
              <th>Links</th>
            </tr>
          </thead>
          <tbody>
            {POAM_ITEMS.map((p) => {
              const ms = p.milestones ?? [];
              const msDone = ms.filter((m) => m.done).length;
              return (
                <tr
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  style={{ background: p.id === detail.id ? 'var(--surface-2)' : undefined }}
                >
                  <td className="mono" style={{ fontWeight: 700 }}>
                    {p.id}
                  </td>
                  <td>
                    <a
                      className="mono annot"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectControl(p.controlId);
                        go('control-detail');
                      }}
                    >
                      {p.controlId}
                    </a>
                  </td>
                  <td>{p.weakness}</td>
                  <td className="muted">{p.owner}</td>
                  <td>
                    <RiskBadge level={p.risk} />
                  </td>
                  <td className="mono">{p.dueDate}</td>
                  <td>
                    <Status s={p.status} />
                  </td>
                  <td>
                    {p.classification === 'Blocker' ? (
                      <Badge tone="bad">Blocker</Badge>
                    ) : (
                      <Badge tone="none">{p.classification}</Badge>
                    )}
                  </td>
                  <td className="mono faint" style={{ fontSize: '.8em', whiteSpace: 'nowrap' }}>
                    {p.evidenceIds?.length ?? 0}ev · {p.taskIds?.length ?? 0}tk · {msDone}/{ms.length}ms
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card title={`POA&M Detail — ${detail.id} · ${detail.controlId}`}>
        {/* Linked control title/summary from reference data when available. */}
        {detailControl && (
          <p className="muted" style={{ margin: '0 0 12px', fontSize: '.88em' }}>
            <strong>Control {detail.controlId}</strong> — {detailControl.title}
            {' · '}
            {detailControl.familyName}
            <br />
            {detailControl.summary}
          </p>
        )}
        <div className="grid-2">
          <Field label="WEAKNESS" value={detail.weakness} area />
          <Field label="REMEDIATION PLAN" value={detail.remediationPlan ?? ''} area />
          <Select label="RESPONSIBLE OWNER" value={detail.owner} />
          <Select label="RESPONSIBLE OFFICE" value={detail.office ?? ''} />
          <Field label="RESOURCE ESTIMATE" value={detail.resourceEstimate ?? ''} />
          <Field label="SCHEDULED COMPLETION" value={detail.dueDate} />
          <Field label="HOW IDENTIFIED" value={detail.howIdentified ?? ''} />
          <Field label="EVIDENCE FOR CLOSURE" placeholder="e.g. data flow diagram + firewall rules export" />
        </div>
        {detail.milestones && (
          <div className="mt">
            <span className="w-label">MILESTONES & INTERIM COMPLETION DATES</span>
            <div className="col" style={{ gap: 6, marginTop: 8 }}>
              {detail.milestones.map((m) => (
                <div key={m.label} className="between w-box" style={{ padding: '7px 12px' }}>
                  <span className="center" style={{ gap: 8 }}>
                    <span
                      className={'dot ' + (m.done ? 'ok' : 'none')}
                      style={{ width: 8, height: 8, borderRadius: '50%' }}
                    />
                    {m.label}
                  </span>
                  <span className="mono faint" style={{ fontSize: '.82em' }}>{m.date}</span>
                </div>
              ))}
            </div>
            <p className="faint" style={{ margin: '8px 0 0', fontSize: '.82em' }}>
              Changes to milestones: {detail.changesToMilestones ?? '—'}
            </p>
          </div>
        )}
        <div className="row wrap gap-sm mt" style={{ fontSize: '.82rem' }}>
          <span className="muted">Linked:</span>
          <Badge tone="none">Control {detail.controlId}</Badge>
          {detail.evidenceIds?.map((id) => <Badge key={id} tone="none">Evidence {id}</Badge>)}
          {detail.taskIds?.map((id) => <Badge key={id} tone="none">Task {id}</Badge>)}
        </div>
        <div className="row gap-sm mt" style={{ justifyContent: 'flex-end' }}>
          <Btn ghost>Save Draft</Btn>
          <Btn primary>Save POA&M Item</Btn>
        </div>
      </Card>
      <SourceRefs ids={['dod-assessment-methodology', 'bf-poam-template', 'cui-poam-template']} />
    </div>
  );
}

/* ---------- 14. EVIDENCE HUB ---------- */
export function EvidenceScreen(_: ScreenProps) {
  const { evidence, requestEvidence, updateEvidence, transitionEvidence } = useData();
  const { controlsById, controls } = useReference();
  const currentClient = useCurrentClient();
  const canReview = useCanReviewEvidence();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<EvidenceStatus | 'All'>('All');
  const [zeroAcceptedOnly, setZeroAcceptedOnly] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const counts = useMemo(() => evidenceCountsByStatus(evidence), [evidence]);
  const gapControlIds = useMemo(() => controlIdsWithoutAcceptedEvidence(evidence), [evidence]);

  const visible = useMemo(
    () =>
      evidence.filter((e) => {
        if (statusFilter !== 'All' && effectiveStatus(e) !== statusFilter) return false;
        if (zeroAcceptedOnly && !(e.controlId && gapControlIds.has(e.controlId))) return false;
        return true;
      }),
    [evidence, statusFilter, zeroAcceptedOnly, gapControlIds],
  );

  // Group the visible items by EFFECTIVE status, in canonical order.
  const groups = useMemo(() => {
    const byStatus = new Map<EvidenceStatus, EvidenceItem[]>();
    for (const e of visible) {
      const s = effectiveStatus(e);
      const arr = byStatus.get(s) ?? [];
      arr.push(e);
      byStatus.set(s, arr);
    }
    return EVIDENCE_OPTIONS.filter((s) => byStatus.has(s)).map(
      (s) => [s, byStatus.get(s)!] as const,
    );
  }, [visible]);

  const detail = (selectedId && evidence.find((e) => e.id === selectedId)) || null;

  return (
    <div className="col">
      <PageHead
        title={`Evidence Hub — ${currentClient?.name ?? 'Client'}`}
        sub="Request, review, and map evidence to controls."
        actions={
          <Btn primary onClick={() => setRequesting(true)}>
            + Request Evidence
          </Btn>
        }
      />
      <WarnBanner tone="bad">
        Metadata + approved secure links only. Never upload CUI or evidence files here — the artifact
        stays in the client's secure store; record where it lives and link to it.
      </WarnBanner>

      {/* status filter chips with per-status counts + the zero-coverage filter */}
      <Card style={{ padding: '6px 6px' }}>
        <div className="row wrap gap-sm" style={{ padding: '8px 10px', alignItems: 'center' }}>
          <button
            className={'w-btn sm' + (statusFilter === 'All' ? ' primary' : ' ghost')}
            onClick={() => setStatusFilter('All')}
          >
            All ({evidence.length})
          </button>
          {EVIDENCE_OPTIONS.map((s) => (
            <button
              key={s}
              className={'w-btn sm' + (statusFilter === s ? ' primary' : ' ghost')}
              onClick={() => setStatusFilter(s)}
            >
              {s} ({counts[s]})
            </button>
          ))}
          <div className="grow" />
          <button
            className={'w-btn sm' + (zeroAcceptedOnly ? ' primary' : ' ghost')}
            title="Show only items whose control has no accepted evidence yet"
            onClick={() => setZeroAcceptedOnly((v) => !v)}
          >
            ⚠ Controls w/ 0 accepted evidence ({gapControlIds.size})
          </button>
        </div>
      </Card>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card style={{ padding: '6px 6px' }}>
          {visible.length === 0 ? (
            <p className="muted" style={{ padding: '14px 12px', margin: 0 }}>
              {evidence.length === 0
                ? 'No evidence yet. Use “Request Evidence” to start the workflow.'
                : 'No evidence matches the current filter.'}
            </p>
          ) : (
            <table className="w-table">
              <thead>
                <tr>
                  <th>Evidence Item</th>
                  <th>Control</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Quality</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([status, items]) => (
                  <Fragment key={status}>
                    <tr>
                      <td colSpan={5} style={{ background: 'var(--fill)', padding: '6px 10px' }}>
                        <span className="row gap-sm" style={{ alignItems: 'center' }}>
                          <Status s={status} />
                          <span className="faint mono" style={{ fontSize: '.78em' }}>
                            {items.length}
                          </span>
                        </span>
                      </td>
                    </tr>
                    {items.map((e) => (
                      <tr
                        key={e.id}
                        onClick={() => setSelectedId(e.id)}
                        style={{ background: e.id === detail?.id ? 'var(--surface-2)' : undefined }}
                      >
                        <td style={{ fontWeight: 700 }}>{e.title}</td>
                        <td className="mono">{e.controlId || '—'}</td>
                        <td className="muted">{e.owner}</td>
                        <td>
                          <Status s={effectiveStatus(e)} />
                        </td>
                        <td>
                          <Status s={e.quality} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {detail ? (
          <EvidenceDetail
            key={detail.id}
            item={detail}
            control={controlsById[detail.controlId]}
            evidence={evidence}
            canReview={canReview}
            onUpdate={updateEvidence}
            onTransition={transitionEvidence}
          />
        ) : (
          <Card title="Evidence Detail">
            <p className="muted" style={{ margin: 0 }}>
              Select an evidence item to review it, or request new evidence.
            </p>
          </Card>
        )}
      </div>

      {requesting && (
        <RequestEvidenceModal
          controls={controls}
          onClose={() => setRequesting(false)}
          onSubmit={(input) => {
            requestEvidence(input);
            setRequesting(false);
          }}
        />
      )}
      <SourceRefs ids={['nist-sp-800-171a', 'bf-evidence-guidance']} />
    </div>
  );
}

/* Human label for each transition button (driven by the legal next status). */
const TRANSITION_LABEL: Record<EvidenceStatus, string> = {
  'Not Requested': 'Mark Not Requested',
  Requested: 'Re-request',
  Uploaded: 'Mark Uploaded',
  'In Review': 'Start Review',
  Accepted: 'Accept',
  'Needs Revision': 'Needs Revision',
  Rejected: 'Reject',
  Missing: 'Mark Missing',
  Expired: 'Mark Expired',
};

function EvidenceDetail({
  item,
  control,
  evidence,
  canReview,
  onUpdate,
  onTransition,
}: {
  item: EvidenceItem;
  control: Control | undefined;
  evidence: EvidenceItem[];
  canReview: boolean;
  onUpdate: (id: string, patch: EvidencePatch) => void;
  onTransition: (id: string, toStatus: EvidenceStatus, note?: string) => void;
}) {
  const [link, setLink] = useState(item.externalLink ?? '');
  const [note, setNote] = useState('');
  const linkTrimmed = link.trim();
  const linkValid = linkTrimmed === '' || isHttpsLink(linkTrimmed);
  const linkChanged = linkTrimmed !== (item.externalLink ?? '');

  const eff = effectiveStatus(item);
  const fresh = effectiveFreshness(item);
  const cov = controlEvidenceCoverage(control, evidence);
  // Transitions act on the STORED status; only the user's allowed moves are shown.
  const nexts = allowedNextStatuses(item.status, canReview);

  return (
    <Card title="Evidence Detail">
      <div className="col" style={{ gap: 12 }}>
        <div className="between">
          <span className="w-label">TITLE</span>
          <strong>{item.title}</strong>
        </div>
        <div className="between">
          <span className="w-label">RELATED CONTROL</span>
          <span className="mono" style={{ textAlign: 'right' }}>
            {item.controlId || '—'}
            {control && (
              <span className="muted" style={{ display: 'block', fontSize: '.82em' }}>
                {control.title} · {control.familyCode}
              </span>
            )}
          </span>
        </div>
        {item.description && (
          <div className="between">
            <span className="w-label">WHAT'S NEEDED</span>
            <span style={{ textAlign: 'right', maxWidth: '70%' }}>{item.description}</span>
          </div>
        )}

        {control && control.assessmentObjectives.length > 0 && (
          <div className="w-box" style={{ padding: '8px 12px' }}>
            <span className="w-label">OBJECTIVE COVERAGE (NIST SP 800-171A) — accepted evidence</span>
            <div className="col" style={{ gap: 4, marginTop: 6, fontSize: '.85em' }}>
              <div className="row gap-sm">
                <Badge tone={cov.status === 'addressed' ? 'ok' : cov.coveredIds.length ? 'warn' : 'none'}>
                  {cov.coveredIds.length}/{cov.total} objectives covered
                </Badge>
                {cov.methodsCovered.map((mth) => (
                  <Badge key={mth} tone="none">
                    {mth.charAt(0).toUpperCase() + mth.slice(1)}
                  </Badge>
                ))}
              </div>
              {cov.coveredIds.length === 0 ? (
                <span className="faint">No accepted evidence covers this control's objectives yet.</span>
              ) : (
                cov.uncoveredIds.length > 0 && (
                  <span className="faint">Uncovered: {cov.uncoveredIds.join(', ')}</span>
                )
              )}
            </div>
          </div>
        )}

        {/* external secure link — https only, with the standing warning */}
        <div className="w-field">
          <span className="w-label">SECURE EXTERNAL LINK</span>
          <input
            className="w-input"
            type="url"
            placeholder="https://… (link to the artifact in the client's secure store)"
            value={link}
            aria-label="Secure external link"
            onChange={(e) => setLink(e.target.value)}
          />
          {!linkValid && (
            <span className="faint" style={{ color: 'var(--bad, #b4232a)', fontSize: '.8em' }}>
              Enter an https:// link. The artifact itself is never uploaded — only a secure link.
            </span>
          )}
          <p className="annot" style={{ margin: '4px 0 0' }}>
            The artifact stays in the client's secure store; this records a pointer only.
          </p>
          <div className="row gap-sm mt" style={{ justifyContent: 'flex-end' }}>
            <Btn
              sm
              primary
              disabled={!linkValid || !linkChanged}
              onClick={() => onUpdate(item.id, { externalLink: linkTrimmed })}
            >
              Save Link
            </Btn>
          </div>
        </div>
        {item.storageLocationNote && (
          <div className="between">
            <span className="w-label">STORAGE LOCATION</span>
            <span className="muted" style={{ textAlign: 'right', maxWidth: '70%' }}>
              {item.storageLocationNote}
            </span>
          </div>
        )}

        <div className="between">
          <span className="w-label">QUALITY</span>
          <InlineSelect
            ariaLabel="Evidence quality"
            value={item.quality}
            options={EVIDENCE_QUALITY_OPTIONS}
            onChange={(q) => onUpdate(item.id, { quality: q })}
          />
        </div>
        <div className="between">
          <span className="w-label">FRESHNESS</span>
          <span className="row gap-sm" style={{ alignItems: 'center' }}>
            <Status s={fresh} />
            <span className="mono faint" style={{ fontSize: '.82em' }}>
              {item.expiresOn ? `expires ${item.expiresOn}` : 'no expiry set'}
            </span>
          </span>
        </div>
        {item.status === 'Accepted' && fresh === 'Expired' && (
          <WarnBanner tone="warn">
            This accepted evidence is past its expiry date — re-collect it (Mark Expired → Re-request).
          </WarnBanner>
        )}

        <div className="between">
          <span className="w-label">CURRENT STATUS</span>
          <Status s={eff} />
        </div>

        <Field
          label="REVIEW / TRANSITION NOTE"
          area
          value={note}
          onChange={setNote}
          placeholder="Optional note recorded with the next status change…"
        />
        {item.notes && (
          <div className="w-box muted" style={{ padding: '8px 12px', fontSize: '.88em' }}>
            <span className="w-eyebrow">Last note</span>
            <p style={{ margin: '4px 0 0' }}>{item.notes}</p>
          </div>
        )}

        <div className="between">
          <span className="w-label">SUPPORTS SSP STATEMENT?</span>
          <div className="row gap-sm">
            {(['Yes', 'Partial', 'No'] as const).map((s) => (
              <button
                key={s}
                className={'w-check' + ((item.sspSupported ?? 'Partial') === s ? ' on radio' : ' radio')}
                onClick={() => onUpdate(item.id, { sspSupported: s })}
              >
                <span className="bx" /> <span>{s}</span>
              </button>
            ))}
          </div>
        </div>

        <hr className="w-hr" style={{ margin: '4px 0' }} />
        <span className="w-label">NEXT STATUS</span>
        {nexts.length === 0 ? (
          <p className="faint" style={{ margin: 0, fontSize: '.85em' }}>
            {canReview
              ? 'No further transitions from this status.'
              : 'No actions available — review transitions are handled by your Benchmark Fox consultant.'}
          </p>
        ) : (
          <div className="row wrap gap-sm" style={{ justifyContent: 'flex-end' }}>
            {nexts.map((s) => (
              <Btn
                key={s}
                primary={s === 'Accepted' || s === 'Uploaded'}
                ghost={s === 'Rejected'}
                onClick={() => onTransition(item.id, s, note.trim() || undefined)}
              >
                {TRANSITION_LABEL[s]}
              </Btn>
            ))}
          </div>
        )}

        <div className="row wrap gap-sm" style={{ fontSize: '.82rem' }}>
          <span className="muted">Linked:</span>
          {item.poamId ? <Badge tone="none">POA&M {item.poamId}</Badge> : null}
          {item.taskId ? <Badge tone="none">Task {item.taskId}</Badge> : null}
          {!item.poamId && !item.taskId && <span className="faint">none</span>}
        </div>
      </div>
    </Card>
  );
}

function RequestEvidenceModal({
  controls,
  onClose,
  onSubmit,
}: {
  controls: Control[];
  onClose: () => void;
  onSubmit: (input: EvidenceRequestInput) => void;
}) {
  const [controlId, setControlId] = useState(controls[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [wholeControl, setWholeControl] = useState(true);
  const [objectiveIds, setObjectiveIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');

  const control = controls.find((c) => c.id === controlId);
  const objectives = control?.assessmentObjectives ?? [];
  const canSubmit = controlId !== '' && title.trim() !== '';

  const toggleObjective = (oid: string) =>
    setObjectiveIds((prev) => (prev.includes(oid) ? prev.filter((x) => x !== oid) : [...prev, oid]));

  return (
    <div
      onClick={onClose}
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
        style={{ width: 'min(620px, 96vw)', maxHeight: '88vh', overflow: 'auto', padding: 24 }}
      >
        <div className="between" style={{ marginBottom: 14 }}>
          <h2 className="w-h2">Request Evidence</h2>
          <Btn onClick={onClose}>✕ Close</Btn>
        </div>
        <div className="col" style={{ gap: 12 }}>
          <div className="w-field">
            <span className="w-label">CONTROL</span>
            <select
              className="w-input"
              aria-label="Control"
              value={controlId}
              onChange={(e) => {
                setControlId(e.target.value);
                setObjectiveIds([]);
              }}
            >
              {controls.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <Field
            label="EVIDENCE TITLE"
            value={title}
            onChange={setTitle}
            placeholder="e.g. MFA enforcement configuration export"
          />

          <div className="w-field">
            <span className="w-label">OBJECTIVES (NIST SP 800-171A)</span>
            <button
              className={'w-check' + (wholeControl ? ' on radio' : ' radio')}
              onClick={() => setWholeControl(true)}
              style={{ marginBottom: 6 }}
            >
              <span className="bx" /> <span>Whole control</span>
            </button>
            <button
              className={'w-check' + (!wholeControl ? ' on radio' : ' radio')}
              onClick={() => setWholeControl(false)}
            >
              <span className="bx" /> <span>Specific objectives</span>
            </button>
            {!wholeControl && (
              <div className="col" style={{ gap: 4, marginTop: 8 }}>
                {objectives.length === 0 ? (
                  <span className="faint">This control has no listed objectives — request the whole control.</span>
                ) : (
                  objectives.map((o) => (
                    <button
                      key={o.objectiveId}
                      className={'w-check' + (objectiveIds.includes(o.objectiveId) ? ' on' : '')}
                      onClick={() => toggleObjective(o.objectiveId)}
                      style={{ textAlign: 'left' }}
                    >
                      <span className="bx" />{' '}
                      <span>
                        <span className="mono">{o.objectiveId}</span> {o.objectiveText}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <Field
            label="WHAT'S NEEDED"
            area
            value={description}
            onChange={setDescription}
            placeholder="Describe the artifact you need from the client…"
          />
          <div className="grid-2">
            <Field label="ASSIGNEE" value={owner} onChange={setOwner} placeholder="e.g. IT Lead" />
            <div className="w-field">
              <span className="w-label">DUE DATE</span>
              <input
                className="w-input"
                type="date"
                aria-label="Due date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
            <Btn ghost onClick={onClose}>
              Cancel
            </Btn>
            <Btn
              primary
              disabled={!canSubmit}
              onClick={() =>
                onSubmit({
                  controlId,
                  title: title.trim(),
                  objectiveIds: wholeControl ? [] : objectiveIds,
                  description: description.trim() || undefined,
                  owner: owner.trim() || undefined,
                  dueDate: dueDate || undefined,
                })
              }
            >
              Request Evidence
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 15. TASKS ---------- */
const HIGH_PRIORITY = new Set(['Critical', 'High']);
export function TasksScreen(_: ScreenProps) {
  const { controlsById } = useReference();
  const currentClient = useCurrentClient();
  // default to the first blocked task, otherwise the first high/critical task,
  // otherwise the first task
  const defaultTask =
    TASKS.find((t) => t.status === 'Blocked') ?? TASKS.find((t) => HIGH_PRIORITY.has(t.priority)) ?? TASKS[0];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = (selectedId && TASKS.find((t) => t.id === selectedId)) || defaultTask;
  // Related control definition from reference data (graceful fallback to ID only).
  const relatedControl = detail.relatedControlId ? controlsById[detail.relatedControlId] : undefined;
  return (
    <div className="col">
      <PageHead
        title={`Tasks — ${currentClient?.name ?? 'Client'}`}
        sub="Assign and track remediation, evidence, SSP, and POA&M work."
        actions={<Btn primary>+ New Task</Btn>}
      />
      <Toolbar search="Search tasks…" filters={['Owner', 'Priority', 'Status', 'Due Date']} />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card style={{ padding: '6px 6px' }}>
          <table className="w-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Owner</th>
                <th>Priority</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {TASKS.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  style={{ background: t.id === detail.id ? 'var(--surface-2)' : undefined }}
                >
                  <td style={{ fontWeight: 700 }}>{t.title}</td>
                  <td className="muted">{t.owner}</td>
                  <td>
                    <RiskBadge level={t.priority} />
                  </td>
                  <td className="mono">{t.dueDate}</td>
                  <td>
                    <Status s={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title={`Task Detail — ${detail.title}`}>
          <div className="col" style={{ gap: 12 }}>
            <Field label="DESCRIPTION" value={detail.description ?? ''} area />
            <div className="grid-2">
              <div className="between">
                <span className="w-label">RELATED CONTROL</span>
                <span className="mono" style={{ textAlign: 'right' }}>
                  {detail.relatedControlId ?? '—'}
                  {relatedControl && (
                    <span className="muted" style={{ display: 'block', fontSize: '.82em' }}>
                      {relatedControl.title} · {relatedControl.familyCode}
                    </span>
                  )}
                </span>
              </div>
              <div className="between">
                <span className="w-label">RELATED POA&M</span>
                <span className="mono">{detail.relatedPoamId ?? '—'}</span>
              </div>
              <Select label="OWNER" value={detail.owner} />
              <Select label="PRIORITY" value={detail.priority} />
            </div>
            <div className="between">
              <span className="w-label">STATUS</span>
              <div className="row gap-sm">
                {['Not Started', 'In Progress', 'Blocked', 'Done'].map((s) => (
                  <Check key={s} label={s} on={s === detail.status} radio />
                ))}
              </div>
            </div>
            <Ph h={80}>[ completion evidence upload ]</Ph>
            <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
              <Btn>Add Comment</Btn>
              <Btn primary>Save Task</Btn>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
