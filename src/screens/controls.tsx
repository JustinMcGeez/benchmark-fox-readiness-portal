/* ============================================================
   Screens — controls: Library, Matrix (the heart), Detail
   Data-driven: reads the control library + the active client's
   assessments from the data layer; the matrix edits persist via the store.
   ============================================================ */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { ScreenProps } from '../types';
import {
  Btn,
  Card,
  Field,
  InlineSelect,
  PageHead,
  RiskBadge,
  Status,
  Tabs,
  WarnBanner,
} from '../components/primitives';
import { Sources } from '../components/SourceBadge';
import { useData } from '../data/store';
import { CURRENT_CLIENT } from '../data/clients';
import {
  CONTROLS_BY_ID,
  CONTROL_LIBRARY,
  EXPECTED_CONTROL_COUNT,
  FAMILIES,
  LIBRARY_COMPLETE,
} from '../data/controls';
import { evidenceForControl } from '../data/evidence';
import { poamForControl } from '../data/poam';
import { tasksForControl } from '../data/tasks';
import {
  EVIDENCE_OPTIONS,
  OWNER_OPTIONS,
  POAM_OPTIONS,
  READINESS_OPTIONS,
  SSP_OPTIONS,
} from '../data/types';
import { controlScoreDisplay, statusCounts } from '../lib/scoring';

/* ---------- 9. CONTROL LIBRARY ---------- */
export function ControlLibraryScreen({ go }: ScreenProps) {
  const { selectControl } = useData();
  const [q, setQ] = useState('');
  const acControls = CONTROL_LIBRARY.filter((c) => c.familyCode === 'AC');
  const matches = (s: string) => s.toLowerCase().includes(q.toLowerCase());

  return (
    <div className="col">
      <PageHead
        title="Control Library"
        sub="Browse CMMC / NIST SP 800-171 controls and Benchmark Fox guidance."
      />
      {!LIBRARY_COMPLETE && (
        <WarnBanner tone="bad">
          Control library is incomplete until all {EXPECTED_CONTROL_COUNT} NIST SP 800-171 Rev. 2
          requirements are imported ({CONTROL_LIBRARY.length} loaded).
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
            {FAMILIES.map((f) => (
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
  const [q, setQ] = useState('');
  const [fam, setFam] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [ssp, setSsp] = useState(ALL);
  const [evidence, setEvidence] = useState(ALL);

  const counts = useMemo(() => statusCounts(assessments), [assessments]);

  const rows = useMemo(() => {
    const term = q.toLowerCase();
    return assessments
      .map((a) => ({ a, c: CONTROLS_BY_ID[a.controlId] }))
      .filter(({ a, c }) => {
        if (!c) return false;
        if (fam !== ALL && c.familyCode !== fam) return false;
        if (status !== ALL && a.status !== status) return false;
        if (ssp !== ALL && a.sspStatus !== ssp) return false;
        if (evidence !== ALL && a.evidenceStatus !== evidence) return false;
        if (term && !(`${c.id} ${c.title} ${c.familyName}`.toLowerCase().includes(term))) return false;
        return true;
      });
  }, [assessments, q, fam, status, ssp, evidence]);

  const famOptions = [ALL, ...FAMILIES.map((f) => f.code)];

  return (
    <div className="col">
      <PageHead
        title={`Controls — ${CURRENT_CLIENT.name}`}
        sub="Track readiness, SSP, evidence, POA&M, score impact, and ownership."
      />
      {!LIBRARY_COMPLETE && (
        <WarnBanner tone="bad">
          Control library is incomplete until all {EXPECTED_CONTROL_COUNT} NIST SP 800-171 Rev. 2
          requirements are imported ({CONTROL_LIBRARY.length} loaded).
        </WarnBanner>
      )}

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
      </div>

      <Card style={{ padding: '6px 6px' }}>
        <div className="between wrap" style={{ padding: '6px 12px', gap: 8 }}>
          <span className="mono faint" style={{ fontSize: '.78em' }}>
            {counts.total} CONTROLS · {counts.met} MET · {counts.partial} PARTIAL · {counts.notMet} NOT MET
            {rows.length !== counts.total && ` · ${rows.length} SHOWN`}
          </span>
          <div className="row gap-sm wrap">
            <Btn sm ghost>Assign Owner</Btn>
            <Btn sm ghost onClick={() => go('evidence')}>Request Evidence</Btn>
            <Btn sm ghost onClick={() => go('poam')}>Create POA&M</Btn>
            <Btn sm>Export Matrix</Btn>
          </div>
        </div>
        <table className="w-table">
          <thead>
            <tr>
              <th>Control</th>
              <th>Fam</th>
              <th>Status</th>
              <th>Score</th>
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
                <td>
                  <InlineSelect
                    ariaLabel="Readiness status"
                    value={a.status}
                    options={READINESS_OPTIONS}
                    onChange={(v) => updateAssessment(a.controlId, { status: v })}
                  />
                </td>
                <td className="num">{controlScoreDisplay(a, c)}</td>
                <td>
                  <InlineSelect
                    ariaLabel="SSP status"
                    value={a.sspStatus}
                    options={SSP_OPTIONS}
                    onChange={(v) => updateAssessment(a.controlId, { sspStatus: v })}
                  />
                </td>
                <td>
                  <InlineSelect
                    ariaLabel="Evidence status"
                    value={a.evidenceStatus}
                    options={EVIDENCE_OPTIONS}
                    onChange={(v) => updateAssessment(a.controlId, { evidenceStatus: v })}
                  />
                </td>
                <td>
                  <InlineSelect
                    ariaLabel="POA&M status"
                    value={a.poamStatus}
                    options={POAM_OPTIONS}
                    onChange={(v) => updateAssessment(a.controlId, { poamStatus: v })}
                  />
                </td>
                <td>
                  <RiskBadge level={a.risk} />
                </td>
                <td>
                  <InlineSelect
                    ariaLabel="Owner"
                    value={a.owner}
                    options={OWNER_OPTIONS}
                    onChange={(v) => updateAssessment(a.controlId, { owner: v })}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 24 }}>
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
export function ControlDetailScreen({ go }: ScreenProps) {
  const { selectedControlId, assessmentFor, updateAssessment } = useData();
  const [tab, setTab] = useState('Overview');
  const tabs = ['Overview', 'Assessment', 'SSP', 'Evidence', 'POA&M', 'Tasks', 'Guidance'];

  const control = CONTROLS_BY_ID[selectedControlId];
  const a = assessmentFor(selectedControlId);
  const evidence = evidenceForControl(selectedControlId);
  const poam = poamForControl(selectedControlId);
  const tasks = tasksForControl(selectedControlId);

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
            {control.familyName.toUpperCase()} · LEVEL {control.level.slice(1)} · SCORE VALUE −
            {control.scoreValue}
          </p>
        </div>
        <RiskBadge level={a.risk} />
      </div>
      {control.scoreValue == null && (
        <WarnBanner tone="warn">
          Scoring not finalized — the official DoD Assessment Methodology deduction value for this
          control has not been imported. Score impact is a placeholder.
        </WarnBanner>
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
              <Card title="Assessment Objectives">
                {control.assessmentObjectives && control.assessmentObjectives.length ? (
                  <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
                    {control.assessmentObjectives.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="faint" style={{ margin: 0 }}>
                    Assessment objectives are defined in NIST SP 800-171A and have not been imported
                    yet (placeholder).
                  </p>
                )}
              </Card>
            </>
          )}
          {tab === 'Assessment' && (
            <Card title="Assessment">
              <div className="col" style={{ gap: 14 }}>
                <div className="between">
                  <span className="w-label">Readiness Status</span>
                  <InlineSelect
                    ariaLabel="Readiness status"
                    value={a.status}
                    options={READINESS_OPTIONS}
                    onChange={(v) => updateAssessment(control.id, { status: v })}
                  />
                </div>
                <div className="between">
                  <span className="w-label">Validation Method</span>
                  <span className="muted" style={{ fontSize: '.9em' }}>Examine · Test</span>
                </div>
                <Field
                  label="Consultant Notes"
                  value={a.consultantNotes ?? ''}
                  placeholder="Findings, verification, follow-ups…"
                  area
                />
              </div>
            </Card>
          )}
          {tab === 'SSP' && (
            <Card title="SSP Statement">
              <Field
                area
                value={a.sspStatement ?? ''}
                placeholder="Document how this control is implemented…"
              />
              <div className="grid-2 mt">
                <div className="between">
                  <span className="w-label">SSP Status</span>
                  <InlineSelect
                    ariaLabel="SSP status"
                    value={a.sspStatus}
                    options={SSP_OPTIONS}
                    onChange={(v) => updateAssessment(control.id, { sspStatus: v })}
                  />
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
              {evidence.length ? (
                <table className="w-table">
                  <tbody>
                    {evidence.map((e) => (
                      <tr key={e.id}>
                        <td>{e.title}</td>
                        <td>
                          <Status s={e.status} />
                        </td>
                        <td className="faint mono">{e.freshness}</td>
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
                {control.scoreValue == null
                  ? 'Not finalized'
                  : `${controlScoreDisplay(a, control)} / −${control.scoreValue}`}
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
            <hr className="w-hr" style={{ margin: '4px 0' }} />
            <Btn primary>Save Changes</Btn>
            <Btn onClick={() => go('evidence')}>Request Evidence</Btn>
            <Btn onClick={() => go('poam')}>Create POA&M</Btn>
          </div>
        </Card>
      </div>
      <Sources ids={control.sourceRefs} />
    </div>
  );
}
