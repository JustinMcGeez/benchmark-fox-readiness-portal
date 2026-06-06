/* ============================================================
   Screens — client: Client Dashboard, Intake, Path, Scoping
   (these render inside the client context bar from Shell)
   ============================================================ */
import { Fragment, useState } from 'react';
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

/* ---------- 5. CLIENT DASHBOARD ---------- */
export function ClientDashboardScreen({ go }: ScreenProps) {
  return (
    <div className="col">
      <div className="grid-4">
        <StatCard k="Readiness" v="62%" />
        <StatCard k="Current Score" v="−38" d="Target: +110" tone="warn" />
        <StatCard k="Open POA&Ms" v="14" />
        <StatCard k="Critical Blockers" v="5" d="High" tone="crit" />
      </div>
      <div className="grid-2">
        <Card title="Overall Readiness">
          <div className="row" style={{ alignItems: 'center', gap: 24 }}>
            <Donut met={45} partial={25} value="62%" label="READY" />
            <Legend
              items={[
                { bg: 'var(--navy)', t: 'Met — 49 controls' },
                { bg: 'var(--silver)', t: 'Partial — 28 controls' },
                { bg: 'var(--fill-2)', t: 'Not Met — 33 controls' },
              ]}
            />
          </div>
        </Card>
        <Card title="Top Readiness Blockers">
          <ol className="col" style={{ gap: 10, margin: 0, paddingLeft: 20, fontSize: '.95em' }}>
            <li>Missing SSP implementation details (AC family)</li>
            <li>
              MFA evidence incomplete <Badge tone="warn">3.5.3</Badge>
            </li>
            <li>
              CUI data flow unclear <Badge tone="bad">Blocker</Badge>
            </li>
            <li>Audit log retention not configured</li>
          </ol>
        </Card>
        <Card title="Score by Family">
          <BarChart
            rows={[
              { l: 'Access Control', p: 55, v: '−12' },
              { l: 'Audit & Acct.', p: 40, v: '−9' },
              { l: 'Config. Mgmt', p: 60, v: '−6' },
              { l: 'Ident. & Auth', p: 35, v: '−8' },
              { l: 'Sys & Comms', p: 70, v: '−3' },
            ]}
          />
        </Card>
        <Card title="Next Recommended Actions">
          <div className="col" style={{ gap: 10 }}>
            <div className="between w-box" style={{ padding: '8px 12px' }}>
              <span>Complete CUI scoping</span>
              <Btn sm onClick={() => go('scope')}>
                Go
              </Btn>
            </div>
            <div className="between w-box" style={{ padding: '8px 12px' }}>
              <span>Upload MFA evidence</span>
              <Btn sm onClick={() => go('evidence')}>
                Go
              </Btn>
            </div>
            <div className="between w-box" style={{ padding: '8px 12px' }}>
              <span>Update SSP for AC controls</span>
              <Btn sm onClick={() => go('ssp')}>
                Go
              </Btn>
            </div>
          </div>
        </Card>
      </div>
      <div className="row gap-sm wrap">
        <Btn primary onClick={() => go('controls')}>
          Continue Control Review
        </Btn>
        <Btn onClick={() => go('evidence')}>Request Evidence</Btn>
        <Btn onClick={() => go('report-preview')}>Generate Executive Summary</Btn>
        <Btn ghost>View Go/No-Go Status</Btn>
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
            <Field label="LEGAL COMPANY NAME" value="Acme Defense Systems, LLC" />
            <Select label="BUSINESS TYPE" value="Prime Contractor" />
            <Field label="APPROX. COMPANY SIZE" placeholder="e.g. 120 employees" />
            <Field label="PRIMARY LOCATIONS" placeholder="Huntsville, AL · 2 sites" />
          </div>
        )}
        {step === 1 && (
          <div className="col">
            <span className="muted">Which contract clauses apply?</span>
            <div className="grid-2">
              {[
                'FAR 52.204-21',
                'DFARS 252.204-7012',
                'DFARS 252.204-7019',
                'DFARS 252.204-7020',
                'DFARS 252.204-7021',
                'Unknown / Needs review',
              ].map((c, i) => (
                <Check key={c} label={c} on={i === 1} />
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="col">
            <span className="muted">What data does the client handle?</span>
            <div className="grid-2">
              {['FCI only', 'CUI', 'CDI / CTI', 'ITAR / Export-Controlled', 'Engineering drawings / CAD'].map(
                (c, i) => (
                  <Check key={c} label={c} on={i === 1 || i === 4} />
                ),
              )}
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
            <span className="w-eyebrow">Internal summary — auto-drafted</span>
            <div className="grid-2 mt" style={{ gap: 10 }}>
              {(
                [
                  ['Likely CMMC Path', 'Level 2 · C3PAO'],
                  ['Estimated Scope', 'CUI enclave'],
                  ['Likely Data Type', 'CUI / CTI'],
                  ['Initial Risk Rating', 'High'],
                  ['Recommended Next Step', 'Scoping Workshop'],
                  ['Proposed Engagement', 'CMMC Readiness Program'],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div
                  key={k}
                  className="between w-box"
                  style={{ padding: '8px 12px', background: 'var(--white)' }}
                >
                  <span className="muted">{k}</span>
                  <strong>{v}</strong>
                </div>
              ))}
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
  return (
    <div className="col" style={{ maxWidth: 860 }}>
      <PageHead
        title="CMMC Path Determination"
        sub="Determine the client's likely CMMC path based on contract and data handling."
      />
      <div className="grid-2">
        <Card title="Contract Clauses">
          <div className="col" style={{ gap: 11 }}>
            {[
              'FAR 52.204-21',
              'DFARS 252.204-7012',
              'DFARS 252.204-7019',
              'DFARS 252.204-7020',
              'DFARS 252.204-7021',
              'Unknown / Needs contract review',
            ].map((c, i) => (
              <Check key={c} label={c} on={i === 1} />
            ))}
          </div>
        </Card>
        <Card title="Data Handling">
          <div className="col" style={{ gap: 11 }}>
            {['FCI only', 'CUI', 'CDI / CTI', 'ITAR / Export-Controlled', 'Engineering drawings / CAD'].map(
              (c, i) => (
                <Check key={c} label={c} on={i === 1} />
              ),
            )}
          </div>
        </Card>
      </div>
      <div className="w-box" style={{ padding: 20, background: 'var(--fill)', borderStyle: 'solid' }}>
        <span className="w-eyebrow">Recommended path</span>
        <div className="between mt" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="w-h2" style={{ fontSize: '1.5em' }}>
              Level 2 · C3PAO Certification
            </div>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              CUI selected and DFARS 252.204-7012 identified.
            </p>
          </div>
          <Badge tone="warn" fill>
            Confidence: Medium
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
        government, or C3PAO determination.
      </WarnBanner>
    </div>
  );
}

/* ---------- 8. SCOPING WORKSPACE ---------- */
export function ScopeScreen({ go }: ScreenProps) {
  const [tab, setTab] = useState('Scope Summary');
  const tabs = ['Scope Summary', 'Assets', 'Users', 'Locations', 'Providers', 'CUI Flows'];
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
            <Select label="ASSESSMENT BOUNDARY" value="CUI Enclave" />
            <Select label="CUI STRATEGY" value="CUI Enclave" />
            <Select label="MSP / ESP INVOLVED" value="Yes" />
            <Select label="CLOUD SERVICES" value="M365 GCC High + Azure" />
          </div>
          <div className="w-field mt">
            <span className="w-label">SCOPE NOTES</span>
            <textarea
              className="w-input"
              rows={3}
              defaultValue="Enclave approach scopes CUI to a dedicated GCC High tenant. Engineering CAD workstations to be isolated. MSP manages endpoints — confirm SPA classification."
            />
          </div>
          <div className="row gap-sm wrap mt">
            <Btn>+ Add Asset</Btn>
            <Btn>+ Add User Group</Btn>
            <Btn>+ Add Provider</Btn>
          </div>
        </Card>
      ) : (
        <Card title={tab}>
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
              <tr>
                <td>GCC High Tenant</td>
                <td>Cloud</td>
                <td>CUI Asset</td>
                <td>
                  <Status s="Yes" />
                </td>
                <td>MSP</td>
                <td>
                  <Status s="Yes" />
                </td>
              </tr>
              <tr>
                <td>CAD Workstations</td>
                <td>Endpoint</td>
                <td>CUI Asset</td>
                <td>
                  <Status s="Yes" />
                </td>
                <td>IT Lead</td>
                <td>
                  <Status s="Yes" />
                </td>
              </tr>
              <tr>
                <td>Firewall (HQ)</td>
                <td>Network</td>
                <td>Security Protection</td>
                <td>
                  <Badge tone="none">No</Badge>
                </td>
                <td>MSP</td>
                <td>
                  <Status s="Yes" />
                </td>
              </tr>
              <tr>
                <td>Marketing Laptops</td>
                <td>Endpoint</td>
                <td>Out-of-Scope</td>
                <td>
                  <Badge tone="none">No</Badge>
                </td>
                <td>IT Lead</td>
                <td>
                  <Badge tone="none">No</Badge>
                </td>
              </tr>
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
