/* ============================================================
   Screens — work: SSP, POA&M, Evidence, Tasks
   Data-driven from the assessment store + evidence/poam/tasks seeds.
   ============================================================ */
import { useMemo, useState } from 'react';
import type { ScreenProps } from '../types';
import {
  Badge,
  Btn,
  Card,
  Check,
  Field,
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
import {
  controlObjectiveCoverage,
  coveredObjectiveIdsForControl,
} from '../lib/objectives';
import { CURRENT_CLIENT } from '../data/clients';
import { EVIDENCE_ITEMS } from '../data/evidence';
import { POAM_ITEMS } from '../data/poam';
import { TASKS } from '../data/tasks';
import type { ClientControlAssessment, SspStatus } from '../data/types';
import { SourceRefs } from '../components/SourceRefs';

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
  const { assessments, selectControl } = useData();
  // Control definitions (titles/families) from the reference-data provider.
  const { controlsById } = useReference();
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
        title={`SSP Workspace — ${CURRENT_CLIENT.name}`}
        sub="Track SSP completeness, accuracy, and implementation statements."
        actions={<Btn onClick={() => go('reports')}>Export SSP</Btn>}
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
                const cov = controlObjectiveCoverage(
                  c,
                  coveredObjectiveIdsForControl(a.controlId, EVIDENCE_ITEMS),
                );
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
  // default to the first blocker, otherwise the first POA&M item
  const defaultPoam = POAM_ITEMS.find((p) => p.classification === 'Blocker') ?? POAM_ITEMS[0];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = (selectedId && POAM_ITEMS.find((p) => p.id === selectedId)) || defaultPoam;
  // Linked control definition from reference data (graceful fallback to ID only).
  const detailControl = controlsById[detail.controlId];

  return (
    <div className="col">
      <PageHead
        title={`POA&M Tracker — ${CURRENT_CLIENT.name}`}
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
  const { controlsById } = useReference();
  // default to the first missing/needs-revision item, otherwise the first item
  const defaultEvidence =
    EVIDENCE_ITEMS.find((e) => e.status === 'Missing' || e.status === 'Needs Revision') ?? EVIDENCE_ITEMS[0];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = (selectedId && EVIDENCE_ITEMS.find((e) => e.id === selectedId)) || defaultEvidence;
  // Related control definition from reference data (graceful fallback to ID only).
  const detailControl = controlsById[detail.controlId];
  return (
    <div className="col">
      <PageHead
        title={`Evidence Hub — ${CURRENT_CLIENT.name}`}
        sub="Request, review, and map evidence to controls."
        actions={<Btn primary>+ Request Evidence</Btn>}
      />
      <Toolbar search="Search evidence…" filters={['Status', 'Control', 'Owner', 'Freshness']} />
      <WarnBanner tone="bad">
        Do not upload CUI unless the approved handling environment and secure transfer method have been
        confirmed.
      </WarnBanner>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card style={{ padding: '6px 6px' }}>
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
              {EVIDENCE_ITEMS.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  style={{ background: e.id === detail.id ? 'var(--surface-2)' : undefined }}
                >
                  <td style={{ fontWeight: 700 }}>{e.title}</td>
                  <td className="mono">{e.controlId}</td>
                  <td className="muted">{e.owner}</td>
                  <td>
                    <Status s={e.status} />
                  </td>
                  <td>
                    <Status s={e.quality} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Evidence Detail">
          <div className="col" style={{ gap: 12 }}>
            <div className="between">
              <span className="w-label">TITLE</span>
              <strong>{detail.title}</strong>
            </div>
            <div className="between">
              <span className="w-label">RELATED CONTROL</span>
              <span className="mono" style={{ textAlign: 'right' }}>
                {detail.controlId}
                {detailControl && (
                  <span className="muted" style={{ display: 'block', fontSize: '.82em' }}>
                    {detailControl.title} · {detailControl.familyCode}
                  </span>
                )}
              </span>
            </div>
            {detailControl && detailControl.assessmentObjectives.length > 0 && (
              <div className="w-box" style={{ padding: '8px 12px' }}>
                <span className="w-label">OBJECTIVE COVERAGE (NIST SP 800-171A)</span>
                {(() => {
                  const cov = controlObjectiveCoverage(
                    detailControl,
                    new Set(detail.objectiveIds ?? []),
                  );
                  return (
                    <div className="col" style={{ gap: 4, marginTop: 6, fontSize: '.85em' }}>
                      <div className="row gap-sm">
                        <Badge tone={cov.coveredIds.length ? 'ok' : 'none'}>
                          {cov.coveredIds.length}/{cov.total} objectives covered
                        </Badge>
                        {cov.methodsCovered.map((mth) => (
                          <Badge key={mth} tone="none">
                            {mth.charAt(0).toUpperCase() + mth.slice(1)}
                          </Badge>
                        ))}
                      </div>
                      {cov.coveredIds.length === 0 ? (
                        <span className="faint">
                          No specific objectives selected — this evidence maps to the control overall.
                        </span>
                      ) : (
                        cov.uncoveredIds.length > 0 && (
                          <span className="faint">Uncovered: {cov.uncoveredIds.join(', ')}</span>
                        )
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="between">
              <span className="w-label">ASSESSMENT OBJECTIVE</span>
              <span className="mono">{detail.assessmentObjective ?? '—'}</span>
            </div>
            <div className="between">
              <span className="w-label">METHOD</span>
              <span>{detail.method ?? '—'}</span>
            </div>
            <div className="between">
              <span className="w-label">STATUS</span>
              <Status s={detail.status} />
            </div>
            <div className="between">
              <span className="w-label">QUALITY</span>
              <Status s={detail.quality} />
            </div>
            <Ph h={110}>[ uploaded file preview / secure link ]</Ph>
            <Field label="CONSULTANT REVIEW NOTES" value={detail.notes ?? ''} placeholder="Quality, gaps, follow-ups…" area />
            <div className="between">
              <span className="w-label">SUPPORTS SSP STATEMENT?</span>
              <div className="row gap-sm">
                {(['Yes', 'Partial', 'No'] as const).map((s) => (
                  <Check key={s} label={s} on={(detail.sspSupported ?? 'Partial') === s} radio />
                ))}
              </div>
            </div>
            <div className="row wrap gap-sm" style={{ fontSize: '.82rem' }}>
              <span className="muted">Linked:</span>
              {detail.poamId ? <Badge tone="none">POA&M {detail.poamId}</Badge> : null}
              {detail.taskId ? <Badge tone="none">Task {detail.taskId}</Badge> : null}
              {!detail.poamId && !detail.taskId && <span className="faint">none</span>}
            </div>
            <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
              <Btn ghost>Reject</Btn>
              <Btn>Needs Revision</Btn>
              <Btn primary>Accept Evidence</Btn>
            </div>
          </div>
        </Card>
      </div>
      <SourceRefs ids={['nist-sp-800-171a', 'bf-evidence-guidance']} />
    </div>
  );
}

/* ---------- 15. TASKS ---------- */
const HIGH_PRIORITY = new Set(['Critical', 'High']);
export function TasksScreen(_: ScreenProps) {
  const { controlsById } = useReference();
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
        title={`Tasks — ${CURRENT_CLIENT.name}`}
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
