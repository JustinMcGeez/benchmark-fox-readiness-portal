/* ============================================================
   Screens — controls: Library, Matrix (the heart), Detail
   Data-driven: reads the control library + the active client's
   assessments from the data layer; the matrix edits persist via the store.
   ============================================================ */
import { useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import type { ScreenProps } from '../types';
import {
  Badge,
  Btn,
  Card,
  EmptyState,
  Field,
  InlineSelect,
  PageHead,
  RiskBadge,
  Status,
  Tabs,
  WarnBanner,
} from '../components/primitives';
import { SourceRefs } from '../components/SourceRefs';
import { ScoringWarning } from '../components/ScoringWarning';
import { useData } from '../data/store';
import { useReference } from '../data/referenceStore';
import { useCurrentClient } from '../data/clientsStore';
import { usePermissions } from '../auth/permissions';
import { CONTROLS_BY_ID, EXPECTED_CONTROL_COUNT } from '../data/controls';
import { poamForControl } from '../data/poam';
import { tasksForControl } from '../data/tasks';
import {
  EVIDENCE_OPTIONS,
  OWNER_OPTIONS,
  POAM_OPTIONS,
  READINESS_OPTIONS,
  SSP_OPTIONS,
} from '../data/types';
import { controlScoreDisplay, deductionImpact, statusCounts } from '../lib/scoring';
import { controlEvidenceCoverage, evidenceForControl } from '../lib/selectors';
import { effectiveFreshness, effectiveStatus } from '../lib/evidenceWorkflow';

/* ---------- 9. CONTROL LIBRARY ---------- */
export function ControlLibraryScreen({ go }: ScreenProps) {
  const { selectControl } = useData();
  // Reference data comes from the provider: Supabase when configured, else the
  // local generated data (with automatic fallback), so the screen always renders.
  const { controls, controlFamilies } = useReference();
  const [q, setQ] = useState('');
  const families = controlFamilies.map((f) => {
    const inFam = controls.filter((c) => c.familyCode === f.code);
    return {
      code: f.code,
      name: f.name,
      count: inFam.length,
      l1Count: inFam.filter((c) => c.level === 'L1').length,
    };
  });
  const libraryComplete = controls.length >= EXPECTED_CONTROL_COUNT;
  const acControls = controls.filter((c) => c.familyCode === 'AC');
  const matches = (s: string) => s.toLowerCase().includes(q.toLowerCase());

  return (
    <div className="col">
      <PageHead
        title="Control Library"
        sub="Browse CMMC / NIST SP 800-171 controls and Benchmark Fox guidance."
      />
      {!libraryComplete && (
        <WarnBanner tone="bad">
          Control library is incomplete until all {EXPECTED_CONTROL_COUNT} NIST SP 800-171 Rev. 2
          requirements are imported ({controls.length} loaded).
        </WarnBanner>
      )}
      <Card style={{ padding: '6px 6px' }}>
        <table className="w-table">
          <thead>
            <tr>
              <th>Family</th>
              <th>Code</th>
              <th>Requirements</th>
              <th>Level 1</th>
              <th>Browse</th>
            </tr>
          </thead>
          <tbody>
            {families.map((f) => (
              <tr key={f.code} onClick={() => go('controls')}>
                <td style={{ fontWeight: 700 }}>{f.name}</td>
                <td className="mono">{f.code}</td>
                <td className="num">{f.count}</td>
                <td className="num">{f.l1Count || '—'}</td>
                <td>
                  <a className="annot">View</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Controls — Access Control">
        <div
          className="w-input center"
          style={{ maxWidth: 320, gap: 8, marginBottom: 12, padding: '7px 12px' }}
        >
          <Search size={15} strokeWidth={2} className="faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Access Control…"
            style={{ border: 'none', outline: 'none', background: 'transparent', font: 'inherit', width: '100%' }}
          />
        </div>
        <table className="w-table">
          <thead>
            <tr>
              <th>Control</th>
              <th>Requirement Summary</th>
              <th>Level</th>
              <th>Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {acControls
              .filter((c) => matches(c.id) || matches(c.title) || matches(c.summary))
              .map((c) => (
                <tr
                  key={c.id}
                  onClick={() => {
                    selectControl(c.id);
                    go('control-detail');
                  }}
                >
                  <td className="mono">{c.code}</td>
                  <td className="muted">{c.summary}</td>
                  <td>{c.level}</td>
                  <td className="num">−{c.scoreValue}</td>
                  <td>
                    <a className="annot">Open</a>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------- 10. CLIENT CONTROL MATRIX (the heart) ---------- */
const ALL = 'All';

export function ControlMatrixScreen({ go }: ScreenProps) {
  const { assessments, updateAssessment, selectControl } = useData();
  const currentClient = useCurrentClient();
  // Client-portal roles get a READ-ONLY matrix (RLS blocks assessment writes;
  // the UI shows status badges instead of editable selects + hides staff actions).
  const { canEditAssessments } = usePermissions();
  // Control definitions from the reference-data provider (Supabase or local).
  const { controls, controlsById, controlFamilies } = useReference();
  const [q, setQ] = useState('');
  const [fam, setFam] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [ssp, setSsp] = useState(ALL);
  const [evidence, setEvidence] = useState(ALL);
  const [highImpactOnly, setHighImpactOnly] = useState(false);

  const counts = useMemo(() => statusCounts(assessments), [assessments]);

  const rows = useMemo(() => {
    const term = q.toLowerCase();
    return assessments
      .map((a) => ({ a, c: controlsById[a.controlId] }))
      .filter(({ a, c }) => {
        if (!c) return false;
        if (fam !== ALL && c.familyCode !== fam) return false;
        if (status !== ALL && a.status !== status) return false;
        if (ssp !== ALL && a.sspStatus !== ssp) return false;
        if (evidence !== ALL && a.evidenceStatus !== evidence) return false;
        if (highImpactOnly && c.sprsDeductionValue !== -5) return false;
        if (term && !(`${c.id} ${c.title} ${c.familyName}`.toLowerCase().includes(term))) return false;
        return true;
      });
  }, [assessments, q, fam, status, ssp, evidence, highImpactOnly, controlsById]);

  const famOptions = [ALL, ...controlFamilies.map((f) => f.code)];
  const libraryComplete = controls.length >= EXPECTED_CONTROL_COUNT;

  // Defensive empty state: the route's <ClientScope> normally guarantees a
  // resolved client here, but if none is selected, guide the user to pick one
  // rather than render a matrix with no engagement context.
  if (!currentClient) {
    return (
      <div className="col">
        <PageHead title="Controls" sub="Track readiness, SSP, evidence, POA&M, and ownership." />
        <Card>
          <EmptyState
            icon={<Users size={22} strokeWidth={1.8} />}
            title="No client selected"
            message="Choose a client engagement to open its control matrix."
            action={{ label: 'Go to Clients', onClick: () => go('clients') }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="col">
      <PageHead
        title={`Controls — ${currentClient.name}`}
        sub="Track readiness, SSP, evidence, POA&M, score impact, and ownership."
      />
      {!libraryComplete && (
        <WarnBanner tone="bad">
          Control library is incomplete until all {EXPECTED_CONTROL_COUNT} NIST SP 800-171 Rev. 2
          requirements are imported ({controls.length} loaded).
        </WarnBanner>
      )}
      <ScoringWarning />

      {/* filter bar */}
      <div className="w-card row wrap" style={{ alignItems: 'center', padding: '10px 12px', gap: 10 }}>
        <div className="w-input center grow" style={{ maxWidth: 300, gap: 8, padding: '7px 12px' }}>
          <Search size={15} strokeWidth={2} className="faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search controls…"
            style={{ border: 'none', outline: 'none', background: 'transparent', font: 'inherit', width: '100%' }}
          />
        </div>
        <div className="grow" />
        <FilterSelect label="Family" value={fam} options={famOptions} onChange={setFam} />
        <FilterSelect label="Status" value={status} options={[ALL, ...READINESS_OPTIONS]} onChange={setStatus} />
        <FilterSelect label="SSP" value={ssp} options={[ALL, ...SSP_OPTIONS]} onChange={setSsp} />
        <FilterSelect label="Evidence" value={evidence} options={[ALL, ...EVIDENCE_OPTIONS]} onChange={setEvidence} />
        <button
          className={'w-btn sm' + (highImpactOnly ? ' primary' : ' ghost')}
          onClick={() => setHighImpactOnly((v) => !v)}
          title="Show only high-impact SPRS controls (−5 deduction)"
        >
          High SPRS Impact (−5)
        </button>
      </div>

      <Card style={{ padding: '6px 6px' }}>
        <div className="between wrap" style={{ padding: '6px 12px', gap: 8 }}>
          <span className="mono faint" style={{ fontSize: '.78em' }}>
            {counts.total} CONTROLS · {counts.met} MET · {counts.partial} PARTIAL · {counts.notMet} NOT MET
            {rows.length !== counts.total && ` · ${rows.length} SHOWN`}
          </span>
          {canEditAssessments && (
            <div className="row gap-sm wrap">
              <Btn sm ghost>Assign Owner</Btn>
              <Btn sm ghost onClick={() => go('evidence')}>Request Evidence</Btn>
              <Btn sm ghost onClick={() => go('poam')}>Create POA&M</Btn>
              <Btn sm>Export Matrix</Btn>
            </div>
          )}
        </div>
        <table className="w-table">
          <thead>
            <tr>
              <th>Control</th>
              <th>Fam</th>
              <th title="Official SPRS deduction if not implemented (DoD Assessment Methodology)">SPRS</th>
              <th>Status</th>
              <th>At-Risk</th>
              <th>SSP</th>
              <th>Evidence</th>
              <th>POA&M</th>
              <th>Risk</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, c }) => (
              <tr
                key={a.controlId}
                onClick={() => {
                  selectControl(a.controlId);
                  go('control-detail');
                }}
              >
                <td className="mono" style={{ fontWeight: 700 }}>{a.controlId}</td>
                <td className="mono faint">{c.familyCode}</td>
                <td className="num">
                  {/* Official SPRS weight; −5 high-impact emphasized. */}
                  {c.sprsDeductionValue === 0 ? (
                    <span className="faint" title={c.scoreNotes}>NA</span>
                  ) : c.sprsDeductionValue === -5 ? (
                    <strong style={{ color: 'var(--bad, #b4232a)' }}>−5</strong>
                  ) : (
                    <span>−{Math.abs(c.sprsDeductionValue)}</span>
                  )}
                </td>
                <td>
                  {canEditAssessments ? (
                    <InlineSelect
                      ariaLabel="Readiness status"
                      value={a.status}
                      options={READINESS_OPTIONS}
                      onChange={(v) => updateAssessment(a.controlId, { status: v })}
                    />
                  ) : (
                    <Status s={a.status} />
                  )}
                </td>
                <td className="num">{controlScoreDisplay(a, c)}</td>
                <td>
                  {canEditAssessments ? (
                    <InlineSelect
                      ariaLabel="SSP status"
                      value={a.sspStatus}
                      options={SSP_OPTIONS}
                      onChange={(v) => updateAssessment(a.controlId, { sspStatus: v })}
                    />
                  ) : (
                    <Status s={a.sspStatus} />
                  )}
                </td>
                <td>
                  {canEditAssessments ? (
                    <InlineSelect
                      ariaLabel="Evidence status"
                      value={a.evidenceStatus}
                      options={EVIDENCE_OPTIONS}
                      onChange={(v) => updateAssessment(a.controlId, { evidenceStatus: v })}
                    />
                  ) : (
                    <Status s={a.evidenceStatus} />
                  )}
                </td>
                <td>
                  {canEditAssessments ? (
                    <InlineSelect
                      ariaLabel="POA&M status"
                      value={a.poamStatus}
                      options={POAM_OPTIONS}
                      onChange={(v) => updateAssessment(a.controlId, { poamStatus: v })}
                    />
                  ) : (
                    <Status s={a.poamStatus} />
                  )}
                </td>
                <td>
                  <RiskBadge level={a.risk} />
                </td>
                <td>
                  {canEditAssessments ? (
                    <InlineSelect
                      ariaLabel="Owner"
                      value={a.owner}
                      options={OWNER_OPTIONS}
                      onChange={(v) => updateAssessment(a.controlId, { owner: v })}
                    />
                  ) : (
                    <span>{a.owner}</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                  No controls match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="w-input"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: 'auto', padding: '7px 10px', fontSize: '.85rem', cursor: 'pointer', color: 'var(--ink-soft)' }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o === ALL ? label : o}
        </option>
      ))}
    </select>
  );
}

/* ---------- 11. CONTROL DETAIL ---------- */
/* `controlId` comes from the /clients/:clientId/controls/:controlId route;
   without it (legacy callers) the store's selected control is shown. */
export function ControlDetailScreen({ go, controlId }: ScreenProps & { controlId?: string }) {
  const { selectedControlId, assessmentFor, updateAssessment, evidence: allEvidence } = useData();
  const { controlsById } = useReference();
  // Read-only for client-portal roles (consultant notes hidden; no edit actions).
  const { canEditAssessments } = usePermissions();
  const [tab, setTab] = useState('Overview');
  const tabs = ['Overview', 'Assessment', 'SSP', 'Evidence', 'POA&M', 'Tasks', 'Guidance'];

  const activeControlId = controlId ?? selectedControlId;
  // Prefer the reference-data control (Supabase or local); fall back to the
  // local generated definition if a reference control is missing.
  const control = controlsById[activeControlId] ?? CONTROLS_BY_ID[activeControlId];
  const a = assessmentFor(activeControlId);
  // Evidence + coverage come from the SAME selectors the Evidence Hub uses.
  const evidence = evidenceForControl(allEvidence, activeControlId);
  const coverage = controlEvidenceCoverage(control, allEvidence);
  const poam = poamForControl(activeControlId);
  const tasks = tasksForControl(activeControlId);

  if (!control || !a) {
    return (
      <div className="col">
        <Btn ghost onClick={() => go('controls')}>← Back to Controls</Btn>
        <Card>Control not found.</Card>
      </div>
    );
  }

  return (
    <div className="col">
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="center" style={{ gap: 8, fontSize: '.8em', marginBottom: 4 }}>
            <a className="muted" style={{ cursor: 'pointer' }} onClick={() => go('controls')}>
              Controls
            </a>
            <span className="faint">/</span>
            <span className="mono">{control.id}</span>
          </div>
          <h1 className="w-h1">
            {control.id} — {control.title}
          </h1>
          <p className="w-sub mono" style={{ fontSize: '.8em' }}>
            {control.familyName.toUpperCase()} · LEVEL {control.level.slice(1)} · SPRS{' '}
            {control.sprsDeductionValue === 0 ? 'NA' : `−${Math.abs(control.sprsDeductionValue)}`}
          </p>
        </div>
        <RiskBadge level={a.risk} />
      </div>
      {control.scoreSource === 'placeholder' && (
        <WarnBanner tone="warn">
          Scoring not finalized — the official DoD Assessment Methodology deduction value for this
          control has not been loaded.
        </WarnBanner>
      )}
      {control.sprsDeductionValue === 0 && (
        <WarnBanner tone="none">
          SPRS value: <strong>NA</strong>. {control.scoreNotes}
        </WarnBanner>
      )}
      {control.sprsDeductionValue !== 0 && (
        <Card title="SPRS Scoring (DoD Assessment Methodology)">
          <div className="grid-3">
            <div className="between">
              <span className="w-label">Official deduction</span>
              <span className="mono">
                {control.sprsDeductionValue === -5 ? (
                  <strong style={{ color: 'var(--bad, #b4232a)' }}>−5</strong>
                ) : (
                  `−${Math.abs(control.sprsDeductionValue)}`
                )}
              </span>
            </div>
            <div className="between">
              <span className="w-label">Current status</span>
              <Status s={a.status} />
            </div>
            <div className="between">
              <span className="w-label">Impact on estimate</span>
              <span className="mono">
                {deductionImpact(a, control) > 0 ? `−${deductionImpact(a, control)}` : '0'}
              </span>
            </div>
          </div>
          {a.status === 'Partial' && (
            <p className="annot" style={{ marginTop: 8 }}>
              Partial is not an official SPRS status. For the estimated score it is treated
              conservatively as Not Met (full −{Math.abs(control.sprsDeductionValue)} deduction); the
              readiness % gives Partial half credit as an internal readiness estimate only.
            </p>
          )}
          <p className="annot" style={{ marginTop: 8 }}>
            {control.scoreSourceVersion ? `${control.scoreSourceVersion} · ` : ''}Estimate only — not an
            official assessment result.
          </p>
        </Card>
      )}
      <Tabs items={tabs} active={tab} onPick={setTab} />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="col">
          {tab === 'Overview' && (
            <>
              <Card title="Requirement">
                <p style={{ margin: 0 }}>{control.requirement}</p>
              </Card>
              <Card title="Plain-English Explanation">
                <p style={{ margin: 0 }} className="muted">
                  {control.explanation || (
                    <span className="faint">Plain-English explanation — to be authored by Benchmark Fox (placeholder).</span>
                  )}
                </p>
              </Card>
              {control.commonMistakes && (
                <Card title="Common Mistakes">
                  <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
                    {control.commonMistakes.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </Card>
              )}
              <Card title="Assessment Objectives (NIST SP 800-171A)">
                <p className="annot" style={{ marginTop: 0 }}>
                  Assessment objectives describe what an assessor may examine, interview, or test.
                  Benchmark Fox uses these for readiness support only.
                </p>
                <div className="col" style={{ gap: 8 }}>
                  {control.assessmentObjectives.map((o) => (
                    <div key={o.objectiveId} className="w-box" style={{ padding: '8px 12px' }}>
                      <div className="row gap-sm" style={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span className="mono" style={{ fontWeight: 700 }}>
                          {o.objectiveId}
                        </span>
                        <span style={{ flex: 1, minWidth: 200 }}>{o.objectiveText}</span>
                      </div>
                      <div className="row gap-sm" style={{ marginTop: 5 }}>
                        {o.assessmentMethods.map((mth) => (
                          <Badge key={mth} tone="none">
                            {mth.charAt(0).toUpperCase() + mth.slice(1)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
          {tab === 'Assessment' && (
            <Card title="Assessment">
              <div className="col" style={{ gap: 14 }}>
                <div className="between">
                  <span className="w-label">Readiness Status</span>
                  {canEditAssessments ? (
                    <InlineSelect
                      ariaLabel="Readiness status"
                      value={a.status}
                      options={READINESS_OPTIONS}
                      onChange={(v) => updateAssessment(control.id, { status: v })}
                    />
                  ) : (
                    <Status s={a.status} />
                  )}
                </div>
                <div className="between">
                  <span className="w-label">Validation Method</span>
                  <span className="muted" style={{ fontSize: '.9em' }}>Examine · Test</span>
                </div>
                {/* Consultant Notes are INTERNAL to Benchmark Fox — never shown to
                    client-portal roles (also stripped server-side by the client view). */}
                {canEditAssessments && (
                  <Field
                    label="Consultant Notes"
                    value={a.consultantNotes ?? ''}
                    placeholder="Findings, verification, follow-ups…"
                    area
                  />
                )}
              </div>
            </Card>
          )}
          {tab === 'SSP' && (
            <Card title="SSP Statement">
              {control.sspGuidance && (
                <div className="w-box muted" style={{ padding: '10px 12px', marginBottom: 12, fontSize: '.92em' }}>
                  <span className="w-eyebrow">Benchmark Fox SSP guidance</span>
                  <p style={{ margin: '4px 0 0' }}>{control.sspGuidance}</p>
                </div>
              )}
              <Field
                area
                value={a.sspStatement ?? ''}
                placeholder="Document how this control is implemented…"
              />
              <div className="grid-2 mt">
                <div className="between">
                  <span className="w-label">SSP Status</span>
                  {canEditAssessments ? (
                    <InlineSelect
                      ariaLabel="SSP status"
                      value={a.sspStatus}
                      options={SSP_OPTIONS}
                      onChange={(v) => updateAssessment(control.id, { sspStatus: v })}
                    />
                  ) : (
                    <Status s={a.sspStatus} />
                  )}
                </div>
                <div className="between">
                  <span className="w-label">Evidence Supports?</span>
                  <Status s={a.evidenceStatus === 'Accepted' ? 'Yes' : a.evidenceStatus === 'Missing' ? 'No' : 'Partial'} />
                </div>
              </div>
            </Card>
          )}
          {tab === 'Evidence' && (
            <Card title="Evidence" action={<Btn sm onClick={() => go('evidence')}>Request</Btn>}>
              {coverage.status !== 'no-objectives' && (
                <div className="row gap-sm" style={{ marginBottom: 10 }}>
                  <Badge
                    tone={
                      coverage.status === 'addressed'
                        ? 'ok'
                        : coverage.coveredIds.length
                          ? 'warn'
                          : 'bad'
                    }
                  >
                    {coverage.coveredIds.length}/{coverage.total} objectives covered by accepted evidence
                  </Badge>
                </div>
              )}
              {evidence.length ? (
                <table className="w-table">
                  <tbody>
                    {evidence.map((e) => (
                      <tr key={e.id}>
                        <td>{e.title}</td>
                        <td>
                          <Status s={effectiveStatus(e)} />
                        </td>
                        <td className="faint mono">{effectiveFreshness(e)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted" style={{ margin: 0 }}>No evidence mapped to this control yet.</p>
              )}
            </Card>
          )}
          {tab === 'POA&M' && (
            <Card title="POA&M">
              {control.poamGuidance && (
                <div className="w-box muted" style={{ padding: '10px 12px', marginBottom: 12, fontSize: '.92em' }}>
                  <span className="w-eyebrow">Benchmark Fox POA&M guidance</span>
                  <p style={{ margin: '4px 0 0' }}>{control.poamGuidance}</p>
                </div>
              )}
              {poam.length ? (
                <div className="col" style={{ gap: 10 }}>
                  {poam.map((p) => (
                    <div key={p.id} className="w-box" style={{ padding: '10px 12px' }}>
                      <div className="between">
                        <span className="mono" style={{ fontWeight: 700 }}>{p.id}</span>
                        <div className="row gap-sm">
                          <RiskBadge level={p.risk} />
                          <Status s={p.status} />
                        </div>
                      </div>
                      <p className="muted" style={{ margin: '6px 0 0', fontSize: '.92em' }}>{p.weakness}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ margin: 0 }}>No open POA&M item for this control.</p>
              )}
              <Btn style={{ marginTop: 12 }} onClick={() => go('poam')}>+ Create POA&M</Btn>
            </Card>
          )}
          {tab === 'Tasks' && (
            <Card title="Tasks">
              {tasks.length ? (
                <table className="w-table">
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.id}>
                        <td>{t.title}</td>
                        <td>{t.owner}</td>
                        <td>
                          <Status s={t.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted" style={{ margin: 0 }}>No tasks linked to this control.</p>
              )}
            </Card>
          )}
          {tab === 'Guidance' && (
            <Card title="Benchmark Fox Guidance">
              <div className="col" style={{ gap: 12 }}>
                {control.guidance?.implementation && (
                  <div>
                    <span className="w-eyebrow">Implementation example</span>
                    <p className="muted" style={{ margin: '4px 0 0' }}>{control.guidance.implementation}</p>
                  </div>
                )}
                {control.guidance?.interview && (
                  <div>
                    <span className="w-eyebrow">Interview question</span>
                    <p className="muted" style={{ margin: '4px 0 0' }}>{control.guidance.interview}</p>
                  </div>
                )}
                {control.evidenceExamples && (
                  <div>
                    <span className="w-eyebrow">Evidence examples</span>
                    <ul className="muted" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {control.evidenceExamples.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!control.guidance && !control.evidenceExamples && (
                  <p className="muted" style={{ margin: 0 }}>No guidance authored yet for this control.</p>
                )}
              </div>
            </Card>
          )}
        </div>
        <Card title="Current Client Status">
          <div className="col" style={{ gap: 14 }}>
            <div className="between">
              <span className="w-label">Readiness</span>
              <Status s={a.status} />
            </div>
            <div className="between">
              <span className="w-label">Risk Rating</span>
              <RiskBadge level={a.risk} />
            </div>
            <div className="between">
              <span className="w-label">Score Impact</span>
              <span className="mono">
                {control.sprsDeductionValue === 0
                  ? 'NA (not point-scored)'
                  : `${controlScoreDisplay(a, control)} / −${Math.abs(control.sprsDeductionValue)}`}
              </span>
            </div>
            <div className="between">
              <span className="w-label">Owner</span>
              <span>{a.owner}</span>
            </div>
            <div className="between">
              <span className="w-label">Due Date</span>
              <span className="mono">{a.dueDate}</span>
            </div>
            <div className="between">
              <span className="w-label">Last Reviewed</span>
              <span className="mono faint">{a.lastReviewed}</span>
            </div>
            <div className="between">
              <span className="w-label">Linked Items</span>
              <span className="row gap-sm" style={{ fontSize: '.8rem' }}>
                <Badge tone={evidence.length ? 'ok' : 'none'}>{evidence.length} evidence</Badge>
                <Badge tone={poam.length ? 'warn' : 'none'}>{poam.length} POA&amp;M</Badge>
                <Badge tone={tasks.length ? 'warn' : 'none'}>{tasks.length} tasks</Badge>
              </span>
            </div>
            {canEditAssessments && (
              <>
                <hr className="w-hr" style={{ margin: '4px 0' }} />
                <Btn primary>Save Changes</Btn>
                <Btn onClick={() => go('evidence')}>Request Evidence</Btn>
                <Btn onClick={() => go('poam')}>Create POA&M</Btn>
              </>
            )}
          </div>
        </Card>
      </div>
      <SourceRefs ids={control.sourceRefs} />
    </div>
  );
}
