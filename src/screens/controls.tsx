/* ============================================================
   Screens — controls: Library, Matrix (the heart), Detail
   ============================================================ */
import { useState } from 'react';
import type { RiskLevel, ScreenProps } from '../types';
import {
  Btn,
  Card,
  Check,
  Field,
  PageHead,
  RiskBadge,
  Select,
  Status,
  Tabs,
  Toolbar,
} from '../components/primitives';

/* ---------- 9. CONTROL LIBRARY ---------- */
const FAMILIES: [string, string, number, RiskLevel][] = [
  ['Access Control', 'AC', 22, 'High'],
  ['Awareness & Training', 'AT', 3, 'Medium'],
  ['Audit & Accountability', 'AU', 9, 'High'],
  ['Configuration Management', 'CM', 9, 'High'],
  ['Identification & Authentication', 'IA', 11, 'High'],
  ['Incident Response', 'IR', 3, 'Medium'],
  ['Maintenance', 'MA', 6, 'Low'],
  ['Media Protection', 'MP', 9, 'Medium'],
  ['System & Comms Protection', 'SC', 16, 'High'],
  ['System & Info Integrity', 'SI', 7, 'High'],
];

export function ControlLibraryScreen({ go }: ScreenProps) {
  return (
    <div className="col">
      <PageHead
        title="Control Library"
        sub="Browse CMMC / NIST SP 800-171 controls and Benchmark Fox guidance."
      />
      <Toolbar search="Search controls…" filters={['Family', 'Level', 'Score']} />
      <Card style={{ padding: '6px 6px' }}>
        <table className="w-table">
          <thead>
            <tr>
              <th>Family</th>
              <th>Code</th>
              <th>Control Count</th>
              <th>Avg Risk</th>
              <th>Guidance</th>
            </tr>
          </thead>
          <tbody>
            {FAMILIES.map((f, i) => (
              <tr key={i} onClick={() => go('control-detail')}>
                <td style={{ fontWeight: 700 }}>{f[0]}</td>
                <td className="mono">{f[1]}</td>
                <td className="num">{f[2]}</td>
                <td>
                  <RiskBadge level={f[3]} />
                </td>
                <td>
                  <a className="annot" style={{ cursor: 'pointer' }}>
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Controls — Access Control">
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
            <tr onClick={() => go('control-detail')}>
              <td className="mono">AC.L2-3.1.1</td>
              <td className="muted">Limit access to authorized users…</td>
              <td>L2</td>
              <td className="num">−5</td>
              <td>
                <a className="annot" style={{ cursor: 'pointer' }}>
                  Open
                </a>
              </td>
            </tr>
            <tr onClick={() => go('control-detail')}>
              <td className="mono">AC.L2-3.1.2</td>
              <td className="muted">Limit access to permitted transactions…</td>
              <td>L2</td>
              <td className="num">−3</td>
              <td>
                <a className="annot" style={{ cursor: 'pointer' }}>
                  Open
                </a>
              </td>
            </tr>
            <tr onClick={() => go('control-detail')}>
              <td className="mono">AC.L2-3.1.3</td>
              <td className="muted">Control the flow of CUI…</td>
              <td>L2</td>
              <td className="num">−5</td>
              <td>
                <a className="annot" style={{ cursor: 'pointer' }}>
                  Open
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------- 10. CLIENT CONTROL MATRIX (the heart) ---------- */
const MATRIX: [string, string, string, string, string, string, string, RiskLevel, string][] = [
  ['3.1.1', 'AC', 'Met', '0', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.1.2', 'AC', 'Partial', '−3', 'Needs Fix', 'Weak', 'Open', 'Medium', 'IT Lead'],
  ['3.1.3', 'AC', 'Not Met', '−5', 'Missing', 'Missing', 'Needed', 'Critical', 'CIO'],
  ['3.1.4', 'AC', 'Not Reviewed', 'TBD', 'Not Reviewed', 'Not Request', 'None', 'Medium', 'Unassigned'],
  ['3.5.3', 'IA', 'Partial', '−3', 'Complete', 'In Review', 'Open', 'High', 'IT Lead'],
  ['3.13.1', 'SC', 'Met', '0', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.3.1', 'AU', 'Not Met', '−5', 'Needs Fix', 'Missing', 'Needed', 'High', 'CIO'],
  ['3.4.2', 'CM', 'Met', '0', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
];

export function ControlMatrixScreen({ go }: ScreenProps) {
  return (
    <div className="col">
      <PageHead
        title="Controls — Acme Defense Systems"
        sub="Track readiness, SSP, evidence, POA&M, score impact, and ownership."
      />
      <Toolbar search="Search controls…" filters={['Family', 'Status', 'Evidence', 'SSP']} />
      <Card style={{ padding: '6px 6px' }}>
        <div className="between" style={{ padding: '6px 12px' }}>
          <span className="mono faint" style={{ fontSize: '.78em' }}>
            110 CONTROLS · 49 MET · 28 PARTIAL · 33 NOT MET
          </span>
          <div className="row gap-sm">
            <Btn sm ghost>
              Assign Owner
            </Btn>
            <Btn sm ghost>
              Request Evidence
            </Btn>
            <Btn sm ghost>
              Create POA&M
            </Btn>
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
            {MATRIX.map((r, i) => (
              <tr key={i} onClick={() => go('control-detail')}>
                <td className="mono" style={{ fontWeight: 700 }}>
                  {r[0]}
                </td>
                <td className="mono faint">{r[1]}</td>
                <td>
                  <Status s={r[2]} />
                </td>
                <td className="num">{r[3]}</td>
                <td>
                  <Status s={r[4]} />
                </td>
                <td>
                  <Status s={r[5]} />
                </td>
                <td>
                  {r[6] === 'None' ? (
                    <span className="faint">—</span>
                  ) : (
                    <Status s={r[6] === 'Needed' ? 'Missing' : 'Ongoing'} />
                  )}
                </td>
                <td>
                  <RiskBadge level={r[7]} />
                </td>
                <td className="muted">{r[8]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------- 11. CONTROL DETAIL ---------- */
export function ControlDetailScreen({ go }: ScreenProps) {
  const [tab, setTab] = useState('Overview');
  const tabs = ['Overview', 'Assessment', 'SSP', 'Evidence', 'POA&M', 'Tasks', 'Guidance'];
  return (
    <div className="col">
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="center" style={{ gap: 8, fontSize: '.8em', marginBottom: 4 }}>
            <a className="muted" style={{ cursor: 'pointer' }} onClick={() => go('controls')}>
              Controls
            </a>
            <span className="faint">/</span>
            <span className="mono">3.1.1</span>
          </div>
          <h1 className="w-h1">3.1.1 — Limit system access to authorized users</h1>
          <p className="w-sub mono" style={{ fontSize: '.8em' }}>
            ACCESS CONTROL · LEVEL 2 · SCORE VALUE −5
          </p>
        </div>
        <RiskBadge level="High" />
      </div>
      <Tabs items={tabs} active={tab} onPick={setTab} />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="col">
          {tab === 'Overview' && (
            <>
              <Card title="Requirement">
                <p style={{ margin: 0 }}>
                  Limit system access to authorized users, processes acting on behalf of users, and
                  devices.
                </p>
              </Card>
              <Card title="Plain-English Explanation">
                <p style={{ margin: 0 }} className="muted">
                  Only approved users, services, and devices should be able to access systems that
                  store, process, or transmit CUI.
                </p>
              </Card>
              <Card title="Common Mistakes">
                <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Shared/generic admin accounts</li>
                  <li>No device authorization list</li>
                  <li>Stale accounts not disabled</li>
                </ul>
              </Card>
            </>
          )}
          {tab === 'Assessment' && (
            <Card title="Assessment">
              <div className="col" style={{ gap: 14 }}>
                <div className="between">
                  <span className="w-label">READINESS STATUS</span>
                  <div className="row gap-sm">
                    {['Met', 'Partial', 'Not Met', 'Not Reviewed'].map((s, i) => (
                      <Check key={s} label={s} on={i === 0} radio />
                    ))}
                  </div>
                </div>
                <div className="between">
                  <span className="w-label">VALIDATION METHOD</span>
                  <div className="row gap-sm">
                    {['Examine', 'Interview', 'Test'].map((s, i) => (
                      <Check key={s} label={s} on={i !== 1} />
                    ))}
                  </div>
                </div>
                <Field label="CONSULTANT NOTES" value="RBAC enforced via Entra ID groups. Verified Jul 1." area />
              </div>
            </Card>
          )}
          {tab === 'SSP' && (
            <Card title="SSP Statement">
              <Field
                area
                value="Access to CUI systems is restricted to authorized personnel via Entra ID role-based groups. Device compliance enforced through Intune. Reviewed quarterly."
              />
              <div className="grid-3 mt">
                <Select label="COMPLETENESS" value="Complete" />
                <Select label="ACCURACY" value="Accurate" />
                <Select label="EVIDENCE SUPPORTS?" value="Yes" />
              </div>
            </Card>
          )}
          {tab === 'Evidence' && (
            <Card title="Evidence" action={<Btn sm onClick={() => go('evidence')}>Request</Btn>}>
              <table className="w-table">
                <tbody>
                  <tr>
                    <td>Entra ID group export</td>
                    <td>
                      <Status s="Accepted" />
                    </td>
                    <td className="faint mono">Current</td>
                  </tr>
                  <tr>
                    <td>Intune compliance policy</td>
                    <td>
                      <Status s="In Review" />
                    </td>
                    <td className="faint mono">Current</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          )}
          {tab === 'POA&M' && (
            <Card title="POA&M">
              <p className="muted" style={{ margin: 0 }}>
                No open POA&M item for this control.
              </p>
              <Btn style={{ marginTop: 12 }} onClick={() => go('poam')}>
                + Create POA&M
              </Btn>
            </Card>
          )}
          {tab === 'Tasks' && (
            <Card title="Tasks">
              <table className="w-table">
                <tbody>
                  <tr>
                    <td>Quarterly access review</td>
                    <td>IT Lead</td>
                    <td>
                      <Status s="In Progress" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </Card>
          )}
          {tab === 'Guidance' && (
            <Card title="Benchmark Fox Guidance">
              <div className="col" style={{ gap: 12 }}>
                <div>
                  <span className="w-eyebrow">Implementation example</span>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    Use Entra ID security groups + Conditional Access to scope CUI app access.
                  </p>
                </div>
                <div>
                  <span className="w-eyebrow">Interview questions</span>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    “How is a new employee granted access to CUI systems?”
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
        <Card title="Current Client Status">
          <div className="col" style={{ gap: 14 }}>
            <div className="between">
              <span className="w-label">READINESS</span>
              <Status s="Met" />
            </div>
            <div className="between">
              <span className="w-label">RISK RATING</span>
              <RiskBadge level="High" />
            </div>
            <div className="between">
              <span className="w-label">SCORE IMPACT</span>
              <span className="mono">0 / −5</span>
            </div>
            <div className="between">
              <span className="w-label">OWNER</span>
              <span>IT Lead</span>
            </div>
            <div className="between">
              <span className="w-label">DUE DATE</span>
              <span className="mono">08/15/2026</span>
            </div>
            <div className="between">
              <span className="w-label">LAST REVIEWED</span>
              <span className="mono faint">Jul 1, 2026</span>
            </div>
            <hr className="w-hr" style={{ margin: '4px 0' }} />
            <Btn primary>Save Changes</Btn>
            <Btn onClick={() => go('evidence')}>Request Evidence</Btn>
            <Btn onClick={() => go('poam')}>Create POA&M</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
