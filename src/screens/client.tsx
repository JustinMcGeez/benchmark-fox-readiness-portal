/* ============================================================
   Screens — client: Client Dashboard, Intake, Path, Scoping
   (these render inside the client context bar from Shell)
   ============================================================ */
import { Fragment, useMemo, useState, type CSSProperties } from 'react';
import type { ScreenProps } from '../types';
import {
  Badge,
  BarChart,
  Btn,
  Card,
  Check,
  Donut,
  Field,
  Legend,
  PageHead,
  Select,
  StatCard,
  Status,
  Tabs,
  WarnBanner,
} from '../components/primitives';
import { useData } from '../data/store';
import { CURRENT_CLIENT } from '../data/clients';
import { CONTROLS_BY_ID } from '../data/controls';
import { INTAKE_SUMMARY_FIELDS, PATH_RECOMMENDATION } from '../data/intake';
import { ASSET_CATEGORIES } from '../data/scope';
import { POAM_ITEMS } from '../data/poam';
import { EVIDENCE_ITEMS } from '../data/evidence';
import { TASKS } from '../data/tasks';
import {
  formatScore,
  readinessPct,
  scoreByFamily,
  scoringFinalized,
  sprsScore,
  SPRS_MAX,
  statusCounts,
} from '../lib/scoring';
import { SourceRefs } from '../components/SourceRefs';
import { ScoringWarning } from '../components/ScoringWarning';
import {
  blockerItems,
  missingEvidenceCount,
  nextActions as selNextActions,
  openPoamItems,
  topBlockers as selTopBlockers,
} from '../lib/selectors';

/* ---------- 5. CLIENT DASHBOARD ---------- */
export function ClientDashboardScreen({ go }: ScreenProps) {
  const { assessments } = useData();

  const counts = useMemo(() => statusCounts(assessments), [assessments]);
  const readiness = useMemo(() => readinessPct(assessments), [assessments]);
  const score = useMemo(() => sprsScore(assessments, CONTROLS_BY_ID), [assessments]);
  const families = useMemo(() => scoreByFamily(assessments, CONTROLS_BY_ID).slice(0, 5), [assessments]);

  const openPoam = openPoamItems(POAM_ITEMS);
  const blockers = blockerItems(POAM_ITEMS);
  const missingEvidence = missingEvidenceCount(EVIDENCE_ITEMS);
  const topBlockers = selTopBlockers(POAM_ITEMS);
  const nextActions = selNextActions(TASKS);

  const notMetTotal = counts.notMet + counts.notReviewed;
  const finalized = scoringFinalized(CONTROLS_BY_ID);

  return (
    <div className="col">
      <WarnBanner tone="none">
        Readiness support only — these figures help plan remediation and do not guarantee CMMC
        certification or constitute an official assessment.
      </WarnBanner>
      <ScoringWarning />
      <div className="grid-4">
        <StatCard k="Readiness" v={`${readiness}%`} />
        <StatCard k="Current Score" v={formatScore(score)} d={`Target: ${SPRS_MAX}`} tone="warn" />
        <StatCard k="Open POA&Ms" v={openPoam.length} />
        <StatCard k="Critical Blockers" v={blockers.length} d="High" tone="crit" />
      </div>
      <div className="grid-2">
        <Card title="Overall Readiness">
          <div className="row" style={{ alignItems: 'center', gap: 24 }}>
            <Donut
              met={counts.applicable ? (counts.met / counts.applicable) * 100 : 0}
              partial={counts.applicable ? (counts.partial / counts.applicable) * 100 : 0}
              value={`${readiness}%`}
              label="READY"
            />
            <Legend
              items={[
                { bg: 'var(--navy)', t: `Met — ${counts.met} controls` },
                { bg: 'var(--silver)', t: `Partial — ${counts.partial} controls` },
                { bg: 'var(--fill-2)', t: `Not Met — ${notMetTotal} controls` },
              ]}
            />
          </div>
        </Card>
        <Card title="Top Readiness Blockers">
          <ol className="col" style={{ gap: 10, margin: 0, paddingLeft: 20, fontSize: '.95em' }}>
            {topBlockers.map((p) => (
              <li key={p.id}>
                {p.weakness}{' '}
                {p.classification === 'Blocker' ? (
                  <Badge tone="bad">Blocker</Badge>
                ) : (
                  <Badge tone="none">{p.controlId}</Badge>
                )}
              </li>
            ))}
          </ol>
        </Card>
        <Card title={finalized ? 'Score by Family' : 'Readiness by Family'}>
          <BarChart
            rows={families.map((f) => ({
              l: f.name,
              p: f.readiness,
              v: finalized ? `−${f.deduction}` : `${f.readiness}%`,
            }))}
          />
        </Card>
        <Card title="Next Recommended Actions">
          <div className="col" style={{ gap: 10 }}>
            {nextActions.map((t) => (
              <div key={t.id} className="between w-box" style={{ padding: '8px 12px' }}>
                <span>{t.title}</span>
                <Btn sm onClick={() => go('tasks')}>
                  Go
                </Btn>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="between wrap" style={{ gap: 12 }}>
        <div className="row gap-sm wrap">
          <Btn primary onClick={() => go('controls')}>
            Continue Control Review
          </Btn>
          <Btn onClick={() => go('evidence')}>Request Evidence</Btn>
          <Btn onClick={() => go('report-preview')}>Generate Executive Summary</Btn>
          <Btn ghost>View Go/No-Go Status</Btn>
        </div>
        <span className="mono faint" style={{ fontSize: '.78rem' }}>
          {missingEvidence} MISSING EVIDENCE · {counts.total} CONTROLS ASSESSED
        </span>
      </div>
    </div>
  );
}

/* ---------- 6. GUIDED INTAKE ---------- */
const INTAKE_STEPS = [
  'Client Info',
  'Contract Trigger',
  'FCI/CUI',
  'Environment',
  'Docs',
  'Goals',
  'Summary',
];

export function IntakeScreen({ go }: ScreenProps) {
  const { intake, updateIntake, toggleContractClause, toggleDataHandling, resetIntake } = useData();
  const [step, setStep] = useState(0);
  const last = step === INTAKE_STEPS.length - 1;
  return (
    <div className="col">
      <PageHead
        title="Guided Intake"
        sub="Capture discovery details and determine the likely CMMC path."
      />
      <Card>
        <div className="w-steps" style={{ marginBottom: 18 }}>
          {INTAKE_STEPS.map((s, i) => (
            <Fragment key={s}>
              <span
                className={'w-step' + (i === step ? ' on' : i < step ? ' done' : '')}
                onClick={() => setStep(i)}
                style={{ cursor: 'pointer' }}
              >
                <span className="n">{i < step ? '✓' : i + 1}</span>
                <span className={'lbl' + (i === step ? ' cur' : '')}>{s}</span>
              </span>
              {i < INTAKE_STEPS.length - 1 && <span className="w-step-line" />}
            </Fragment>
          ))}
        </div>
        <div className="mono faint" style={{ fontSize: '.78em', marginBottom: 14 }}>
          STEP {step + 1} OF {INTAKE_STEPS.length}
        </div>

        {step === 0 && (
          <div className="grid-2">
            <Field label="LEGAL COMPANY NAME" value={`${CURRENT_CLIENT.name}, LLC`} />
            <Select label="BUSINESS TYPE" value="Prime Contractor" />
            <Field label="APPROX. COMPANY SIZE" placeholder="e.g. 120 employees" />
            <Field label="PRIMARY LOCATIONS" placeholder="Huntsville, AL · 2 sites" />
          </div>
        )}
        {step === 1 && (
          <div className="col">
            <span className="muted">Which contract clauses apply?</span>
            <div className="grid-2">
              {intake.contractClauses.map((c) => (
                <span
                  key={c.label}
                  onClick={() => toggleContractClause(c.label)}
                  style={{ cursor: 'pointer' }}
                >
                  <Check label={c.label} on={c.selected} />
                </span>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="col">
            <span className="muted">What data does the client handle?</span>
            <div className="grid-2">
              {intake.dataHandling.map((c) => (
                <span
                  key={c.label}
                  onClick={() => toggleDataHandling(c.label)}
                  style={{ cursor: 'pointer' }}
                >
                  <Check label={c.label} on={c.selected} />
                </span>
              ))}
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="grid-2">
            <Select label="CLOUD SERVICES" value="M365 GCC High" />
            <Select label="MSP / ESP INVOLVED" value="Yes — managed IT" />
            <Field label="# OF ENDPOINTS" placeholder="approx." />
            <Field label="KEY SYSTEMS" placeholder="ERP, file share, CAD…" area />
          </div>
        )}
        {step === 4 && (
          <div className="col">
            <span className="muted">Existing documentation on hand?</span>
            <div className="grid-2">
              {[
                'System Security Plan (SSP)',
                'POA&M',
                'Network diagram',
                'Asset inventory',
                'Policies & procedures',
                'Prior assessment',
              ].map((c, i) => (
                <Check key={c} label={c} on={i === 2} />
              ))}
            </div>
          </div>
        )}
        {step === 5 && (
          <div className="col">
            <Field label="READINESS GOALS" placeholder="e.g. C3PAO assessment-ready by Q3" area />
            <Field label="KNOWN PAIN POINTS" placeholder="e.g. no MFA, unclear CUI boundary" area />
          </div>
        )}
        {step === 6 && (
          <div className="w-box fill" style={{ padding: 18 }}>
            <span className="w-eyebrow">Internal summary — editable, auto-drafted</span>
            <div className="grid-2 mt" style={{ gap: 10 }}>
              {INTAKE_SUMMARY_FIELDS.map((f) => (
                <label
                  key={f.key}
                  className="between w-box"
                  style={{ padding: '8px 12px', background: 'var(--white)', gap: 10 }}
                >
                  <span className="muted">{f.label}</span>
                  <input
                    className="w-input"
                    style={{ maxWidth: 210, textAlign: 'right', padding: '4px 8px' }}
                    value={intake[f.key]}
                    onChange={(e) => updateIntake({ [f.key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <div className="between mt">
              <span className="faint" style={{ fontSize: '.8em' }}>
                ✓ Auto-saved to this browser (localStorage)
              </span>
              <Btn sm ghost onClick={resetIntake}>
                ↺ Reset to seed
              </Btn>
            </div>
          </div>
        )}
        <hr className="w-hr" />
        <div className="between">
          <Btn ghost onClick={() => (step > 0 ? setStep(step - 1) : go('create-client'))}>
            ← Back
          </Btn>
          <div className="row gap-sm">
            <Btn>Save Progress</Btn>
            {last ? (
              <Btn primary onClick={() => go('path')}>
                Determine CMMC Path →
              </Btn>
            ) : (
              <Btn primary onClick={() => setStep(step + 1)}>
                Next →
              </Btn>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ---------- 7. CMMC PATH DETERMINATION ---------- */
export function PathScreen({ go }: ScreenProps) {
  const { intake, toggleContractClause, toggleDataHandling } = useData();
  return (
    <div className="col" style={{ maxWidth: 860 }}>
      <PageHead
        title="CMMC Path Determination"
        sub="Determine the client's likely CMMC path based on contract and data handling."
      />
      <div className="grid-2">
        <Card title="Contract Clauses">
          <div className="col" style={{ gap: 11 }}>
            {intake.contractClauses.map((c) => (
              <span key={c.label} onClick={() => toggleContractClause(c.label)} style={{ cursor: 'pointer' }}>
                <Check label={c.label} on={c.selected} />
              </span>
            ))}
          </div>
        </Card>
        <Card title="Data Handling">
          <div className="col" style={{ gap: 11 }}>
            {intake.dataHandling.map((c) => (
              <span key={c.label} onClick={() => toggleDataHandling(c.label)} style={{ cursor: 'pointer' }}>
                <Check label={c.label} on={c.selected} />
              </span>
            ))}
          </div>
        </Card>
      </div>
      <div className="w-box" style={{ padding: 20, background: 'var(--fill)', borderStyle: 'solid' }}>
        <span className="w-eyebrow">Recommended path</span>
        <div className="between mt" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="w-h2" style={{ fontSize: '1.5em' }}>
              {PATH_RECOMMENDATION.path}
            </div>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {PATH_RECOMMENDATION.reason}
            </p>
          </div>
          <Badge tone="warn" fill>
            Confidence: {PATH_RECOMMENDATION.confidence}
          </Badge>
        </div>
      </div>
      <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
        <Btn onClick={() => go('client-dashboard')}>Mark for Contract Review</Btn>
        <Btn primary onClick={() => go('scope')}>
          Save Recommendation →
        </Btn>
      </div>
      <WarnBanner tone="none">
        This recommendation supports readiness planning only and does not replace legal, contracting,
        government, or C3PAO determination. CMMC path determination is not legal or contracting advice.
      </WarnBanner>
      <SourceRefs
        ids={[
          '32-cfr-part-170',
          'far-52-204-21',
          'dfars-252-204-7012',
          'dfars-252-204-7019',
          'dfars-252-204-7020',
        ]}
      />
    </div>
  );
}

/* ---------- 8. SCOPING WORKSPACE ---------- */
export function ScopeScreen({ go }: ScreenProps) {
  const {
    scope,
    updateScopeSummary,
    addAsset,
    updateAsset,
    toggleAssetInScope,
    toggleAssetHandlesCui,
    resetScope,
  } = useData();
  const [tab, setTab] = useState('Scope Summary');
  const tabs = ['Scope Summary', 'Assets', 'Users', 'Locations', 'Providers', 'CUI Flows'];
  const summary = scope.summary;
  const cellInput: CSSProperties = { padding: '4px 8px', fontSize: '.88em' };
  return (
    <div className="col">
      <PageHead
        title="Scoping Workspace"
        sub="Define users, systems, locations, providers, and CUI data flows."
        actions={<Btn onClick={() => go('controls')}>Export Scope Summary</Btn>}
      />
      <Tabs items={tabs} active={tab} onPick={setTab} />
      {tab === 'Scope Summary' ? (
        <Card>
          <div className="grid-2">
            <div className="w-field">
              <span className="w-label">ASSESSMENT BOUNDARY</span>
              <input className="w-input" value={summary.assessmentBoundary} onChange={(e) => updateScopeSummary({ assessmentBoundary: e.target.value })} />
            </div>
            <div className="w-field">
              <span className="w-label">CUI STRATEGY</span>
              <input className="w-input" value={summary.cuiStrategy} onChange={(e) => updateScopeSummary({ cuiStrategy: e.target.value })} />
            </div>
            <div className="w-field">
              <span className="w-label">MSP / ESP INVOLVED</span>
              <input className="w-input" value={summary.mspInvolved} onChange={(e) => updateScopeSummary({ mspInvolved: e.target.value })} />
            </div>
            <div className="w-field">
              <span className="w-label">CLOUD SERVICES</span>
              <input className="w-input" value={summary.cloudServices} onChange={(e) => updateScopeSummary({ cloudServices: e.target.value })} />
            </div>
          </div>
          <div className="w-field mt">
            <span className="w-label">SCOPE NOTES</span>
            <textarea className="w-input" rows={3} value={summary.notes} onChange={(e) => updateScopeSummary({ notes: e.target.value })} />
          </div>
          <div className="between wrap mt" style={{ gap: 8 }}>
            <div className="row gap-sm wrap">
              <Btn primary onClick={addAsset}>+ Add Asset</Btn>
              <Btn onClick={() => setTab('Assets')}>View Assets ({scope.assets.length})</Btn>
            </div>
            <div className="center gap-sm">
              <span className="faint" style={{ fontSize: '.8em' }}>
                ✓ Auto-saved to this browser
              </span>
              <Btn sm ghost onClick={resetScope}>
                ↺ Reset to seed
              </Btn>
            </div>
          </div>
        </Card>
      ) : (
        <Card
          title={tab}
          action={<Btn sm primary onClick={addAsset}>+ Add Asset</Btn>}
        >
          <table className="w-table">
            <thead>
              <tr>
                <th>Asset Name</th>
                <th>Type</th>
                <th>Category</th>
                <th>Handles CUI?</th>
                <th>Owner</th>
                <th>In Scope?</th>
              </tr>
            </thead>
            <tbody>
              {scope.assets.map((a) => (
                <tr key={a.id}>
                  <td>
                    <input className="w-input" style={cellInput} value={a.name} onChange={(e) => updateAsset(a.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <input className="w-input" style={{ ...cellInput, width: 100 }} value={a.type} onChange={(e) => updateAsset(a.id, { type: e.target.value })} />
                  </td>
                  <td>
                    <select className="w-inline-select" value={a.category} onChange={(e) => updateAsset(a.id, { category: e.target.value as typeof a.category })}>
                      {ASSET_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span style={{ cursor: 'pointer' }} onClick={() => toggleAssetHandlesCui(a.id)}>
                      {a.handlesCui ? <Status s="Yes" /> : <Badge tone="none">No</Badge>}
                    </span>
                  </td>
                  <td>
                    <input className="w-input" style={{ ...cellInput, width: 100 }} value={a.owner} onChange={(e) => updateAsset(a.id, { owner: e.target.value })} />
                  </td>
                  <td>
                    <span style={{ cursor: 'pointer' }} onClick={() => toggleAssetInScope(a.id)}>
                      {a.inScope ? <Status s="Yes" /> : <Badge tone="none">No</Badge>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <div className="annot">
        Asset categories: CUI · Security Protection · Contractor Risk Managed · Specialized ·
        Out-of-Scope
      </div>
    </div>
  );
}
