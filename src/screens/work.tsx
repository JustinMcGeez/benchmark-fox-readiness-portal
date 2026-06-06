/* ============================================================
   Screens — work: SSP, POA&M, Evidence, Tasks
   ============================================================ */
import { useState } from 'react';
import type { RiskLevel, ScreenProps } from '../types';
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

/* ---------- 12. SSP WORKSPACE ---------- */
export function SSPScreen({ go }: ScreenProps) {
  const [tab, setTab] = useState('Control Statements');
  return (
    <div className="col">
      <PageHead
        title="SSP Workspace — Acme Defense Systems"
        sub="Track SSP completeness, accuracy, and implementation statements."
        actions={<Btn onClick={() => go('reports')}>Export SSP</Btn>}
      />
      <div className="grid-4">
        <StatCard k="Complete" v="61" d="statements" tone="ok" />
        <StatCard k="Needs Update" v="22" tone="warn" />
        <StatCard k="Missing" v="27" tone="bad" />
        <StatCard k="Mismatch w/ Evidence" v="8" tone="warn" />
      </div>
      <Tabs items={['SSP Summary', 'Control Statements', 'Gaps', 'Export']} active={tab} onPick={setTab} />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card style={{ padding: '6px 6px' }}>
          <table className="w-table">
            <thead>
              <tr>
                <th>Control</th>
                <th>SSP Status</th>
                <th>Implementation</th>
                <th>Evidence?</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono">3.1.1</td>
                <td>
                  <Status s="Complete" />
                </td>
                <td>
                  <Status s="Implemented" />
                </td>
                <td>
                  <Status s="Yes" />
                </td>
                <td>
                  <a className="annot" style={{ cursor: 'pointer' }}>
                    Edit
                  </a>
                </td>
              </tr>
              <tr>
                <td className="mono">3.1.2</td>
                <td>
                  <Status s="Needs Fix" />
                </td>
                <td>
                  <Status s="Implemented" />
                </td>
                <td>
                  <Status s="Partial" />
                </td>
                <td>
                  <a className="annot" style={{ cursor: 'pointer' }}>
                    Edit
                  </a>
                </td>
              </tr>
              <tr>
                <td className="mono">3.1.3</td>
                <td>
                  <Status s="Missing" />
                </td>
                <td>
                  <Status s="Not Implemented" />
                </td>
                <td>
                  <Status s="No" />
                </td>
                <td>
                  <a className="annot" style={{ cursor: 'pointer' }}>
                    Draft
                  </a>
                </td>
              </tr>
              <tr>
                <td className="mono">3.5.3</td>
                <td>
                  <Status s="Complete" />
                </td>
                <td>
                  <Status s="Implemented" />
                </td>
                <td>
                  <Status s="Partial" />
                </td>
                <td>
                  <a className="annot" style={{ cursor: 'pointer' }}>
                    Edit
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
        <Card title="SSP Statement Editor — 3.1.1">
          <Field
            label="CURRENT SSP STATEMENT"
            area
            value="Access to CUI systems is restricted to authorized personnel via Entra ID role-based groups, with device compliance enforced through Intune."
            rows={5}
          />
          <div className="grid-3 mt">
            <Select label="COMPLETENESS" value="Complete" />
            <Select label="ACCURACY" value="Accurate" />
            <Select label="EVIDENCE SUPPORTS" value="Yes" />
          </div>
          <div className="w-field mt">
            <span className="w-label">RECOMMENDED BENCHMARK FOX LANGUAGE</span>
            <div className="w-box fill muted" style={{ padding: 12, fontSize: '.92em' }}>
              “The organization limits system access to authorized users through [identity provider]
              security groups, enforced by conditional access policies and reviewed [frequency].”
            </div>
          </div>
          <div className="row gap-sm mt" style={{ justifyContent: 'flex-end' }}>
            <Btn primary>Save SSP Notes</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- 13. POA&M TRACKER ---------- */
const POAM: [string, string, string, RiskLevel, string, string, string][] = [
  ['3.1.3', 'CUI flow not controlled', 'CIO', 'High', '08/01', 'Ongoing', 'Blocker'],
  ['3.5.3', 'MFA evidence incomplete', 'IT Lead', 'High', '07/15', 'Ongoing', 'Readiness'],
  ['3.3.1', 'Audit logging not centralized', 'MSP', 'High', '07/22', 'Blocked', 'Blocker'],
  ['3.12.4', 'SSP outdated', 'CIO', 'Medium', '07/30', 'Ongoing', 'Internal'],
  ['3.13.1', 'Boundary defense partial', 'MSP', 'Medium', '08/05', 'Not Started', 'Readiness'],
];

export function POAMScreen({ go }: ScreenProps) {
  return (
    <div className="col">
      <PageHead
        title="POA&M Tracker — Acme Defense Systems"
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
              <th>Control</th>
              <th>Weakness</th>
              <th>Owner</th>
              <th>Risk</th>
              <th>Due</th>
              <th>Status</th>
              <th>Class</th>
            </tr>
          </thead>
          <tbody>
            {POAM.map((p, i) => (
              <tr key={i} onClick={() => go('control-detail')}>
                <td className="mono" style={{ fontWeight: 700 }}>
                  {p[0]}
                </td>
                <td>{p[1]}</td>
                <td className="muted">{p[2]}</td>
                <td>
                  <RiskBadge level={p[3]} />
                </td>
                <td className="mono">{p[4]}</td>
                <td>
                  <Status s={p[5]} />
                </td>
                <td>
                  {p[6] === 'Blocker' ? <Badge tone="bad">Blocker</Badge> : <Badge tone="none">{p[6]}</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="POA&M Detail — 3.1.3  ·  CUI flow not controlled">
        <div className="grid-2">
          <Field
            label="WEAKNESS"
            value="CUI data flow between CAD workstations and file share is not controlled or documented."
            area
          />
          <Field
            label="REMEDIATION PLAN"
            value="Implement enclave segmentation; route CUI through GCC High; document data flow diagram."
            area
          />
          <Select label="RESPONSIBLE OWNER" value="CIO" />
          <Select label="RESPONSIBLE OFFICE" value="IT / Security" />
          <Field label="RESOURCE ESTIMATE" value="40 hrs + segmentation license" />
          <Field label="SCHEDULED COMPLETION" value="08/01/2026" />
          <Field label="HOW IDENTIFIED" value="Scoping workshop — CUI boundary review" />
          <Field label="EVIDENCE FOR CLOSURE" placeholder="e.g. data flow diagram + firewall rules export" />
        </div>
        <div className="row gap-sm mt" style={{ justifyContent: 'flex-end' }}>
          <Btn ghost>Save Draft</Btn>
          <Btn primary>Save POA&M Item</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ---------- 14. EVIDENCE HUB ---------- */
const EVIDENCE: [string, string, string, string, string, string][] = [
  ['MFA Configuration Screenshot', '3.5.3', 'IT Lead', 'In Review', 'Acceptable', 'Current'],
  ['Quarterly Access Review', '3.1.5', 'HR / IT', 'Missing', 'Missing', 'N/A'],
  ['Firewall Rules Export', '3.13.1', 'MSP', 'Accepted', 'Strong', 'Current'],
  ['Audit Log Retention Policy', '3.3.1', 'MSP', 'Requested', 'Missing', 'N/A'],
  ['Entra ID Group Export', '3.1.1', 'IT Lead', 'Accepted', 'Strong', 'Current'],
];

export function EvidenceScreen(_: ScreenProps) {
  return (
    <div className="col">
      <PageHead
        title="Evidence Hub — Acme Defense Systems"
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
              {EVIDENCE.map((e, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700 }}>{e[0]}</td>
                  <td className="mono">{e[1]}</td>
                  <td className="muted">{e[2]}</td>
                  <td>
                    <Status s={e[3]} />
                  </td>
                  <td>
                    <Status s={e[4]} />
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
              <strong>MFA Config Screenshot</strong>
            </div>
            <div className="between">
              <span className="w-label">RELATED CONTROL</span>
              <span className="mono">3.5.3</span>
            </div>
            <div className="between">
              <span className="w-label">METHOD</span>
              <span>Examine / Test</span>
            </div>
            <div className="between">
              <span className="w-label">STATUS</span>
              <Status s="In Review" />
            </div>
            <Ph h={120}>[ uploaded file preview / secure link ]</Ph>
            <Field label="CONSULTANT REVIEW NOTES" placeholder="Quality, gaps, follow-ups…" area />
            <div className="between">
              <span className="w-label">SUPPORTS SSP STATEMENT?</span>
              <div className="row gap-sm">
                {['Yes', 'Partial', 'No'].map((s, i) => (
                  <Check key={s} label={s} on={i === 1} radio />
                ))}
              </div>
            </div>
            <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
              <Btn ghost>Reject</Btn>
              <Btn>Needs Revision</Btn>
              <Btn primary>Accept Evidence</Btn>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- 15. TASKS ---------- */
const TASKS: [string, string, RiskLevel, string, string][] = [
  ['Upload MFA evidence', 'IT Lead', 'High', '07/15', 'In Progress'],
  ['Update SSP for AC controls', 'CIO', 'High', '07/20', 'Not Started'],
  ['Provide CUI data flow diagram', 'IT / MSP', 'Critical', '07/12', 'Blocked'],
  ['Configure audit log retention', 'MSP', 'High', '07/22', 'Not Started'],
  ['Quarterly access review export', 'HR / IT', 'Medium', '07/28', 'In Progress'],
];

export function TasksScreen(_: ScreenProps) {
  return (
    <div className="col">
      <PageHead
        title="Tasks — Acme Defense Systems"
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
              {TASKS.map((t, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700 }}>{t[0]}</td>
                  <td className="muted">{t[1]}</td>
                  <td>
                    <RiskBadge level={t[2]} />
                  </td>
                  <td className="mono">{t[3]}</td>
                  <td>
                    <Status s={t[4]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Task Detail — Provide CUI data flow diagram">
          <div className="col" style={{ gap: 12 }}>
            <Field
              label="DESCRIPTION"
              value="Document how CUI moves between CAD workstations, file share, and GCC High tenant."
              area
            />
            <div className="grid-2">
              <div className="between">
                <span className="w-label">RELATED CONTROL</span>
                <span className="mono">3.1.3</span>
              </div>
              <div className="between">
                <span className="w-label">RELATED POA&M</span>
                <span className="mono">PM-014</span>
              </div>
              <Select label="OWNER" value="IT / MSP" />
              <Select label="PRIORITY" value="Critical" />
            </div>
            <div className="between">
              <span className="w-label">STATUS</span>
              <div className="row gap-sm">
                {['Not Started', 'In Progress', 'Blocked', 'Done'].map((s, i) => (
                  <Check key={s} label={s} on={i === 2} radio />
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
