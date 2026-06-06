/* ============================================================
   Screens — core: Login, Internal Dashboard, Clients, Create Client
   ============================================================ */
import type { ScreenProps, RiskLevel } from '../types';
import { ShieldCheck } from 'lucide-react';
import {
  BarChart,
  Btn,
  Card,
  Check,
  Field,
  PageHead,
  RiskBadge,
  Select,
  StatCard,
  Toolbar,
} from '../components/primitives';
import { BrandLockup, BrandLogo } from '../components/Brand';

/* ---------- 1. LOGIN ---------- */
export function LoginScreen({ go }: ScreenProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      {/* brand panel */}
      <div
        className="hide-narrow"
        style={{
          flex: '1 1 0',
          background: 'var(--brand-grad)',
          color: 'var(--navy-ink)',
          padding: '56px 60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(1100px 480px at 110% -10%, rgba(255,255,255,.10), transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <BrandLockup variant="white" size={30} />
        <div style={{ position: 'relative', maxWidth: 460 }}>
          <h1
            style={{
              fontFamily: 'var(--head)',
              fontWeight: 700,
              fontSize: '2.3rem',
              lineHeight: 1.15,
              margin: 0,
              letterSpacing: '-.01em',
            }}
          >
            Secure Missions.
            <br />
            Measurable Readiness.
          </h1>
          <p style={{ color: 'rgba(243,246,251,.74)', fontSize: '1rem', marginTop: 16, lineHeight: 1.6 }}>
            The Benchmark Fox command center for CMMC readiness — track controls, evidence, SSP,
            and POA&amp;M across every engagement.
          </p>
          <div className="row wrap" style={{ gap: 10, marginTop: 26 }}>
            {['Trusted Partner', 'Proven Results', 'Secure · Compliant'].map((t) => (
              <span
                key={t}
                className="center"
                style={{
                  gap: 7,
                  fontSize: '.78rem',
                  fontWeight: 600,
                  color: 'rgba(243,246,251,.82)',
                  border: '1px solid rgba(255,255,255,.18)',
                  borderRadius: 999,
                  padding: '6px 12px',
                }}
              >
                <ShieldCheck size={14} strokeWidth={2.2} /> {t}
              </span>
            ))}
          </div>
        </div>
        <span style={{ position: 'relative', fontSize: '.78rem', color: 'rgba(243,246,251,.45)', fontFamily: 'var(--mono)' }}>
          IT Solutions · Secure Missions · Measurable Impact
        </span>
      </div>

      {/* sign-in panel */}
      <div
        style={{
          flex: '1 1 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          background: 'var(--paper)',
        }}
      >
        <div style={{ width: 'min(400px, 100%)' }}>
          <BrandLogo variant="navy" width={150} style={{ margin: '0 auto 24px' }} />
          <h2 className="w-h2" style={{ fontSize: '1.45rem', textAlign: 'center' }}>
            Sign in to your portal
          </h2>
          <p className="w-sub" style={{ textAlign: 'center', marginBottom: 26 }}>
            Authorized Benchmark Fox users only.
          </p>
          <div className="w-card col" style={{ textAlign: 'left', gap: 16 }}>
            <Field label="Email address" placeholder="you@benchmarkfox.com" />
            <Field label="Password" placeholder="••••••••" />
            <div className="between">
              <Check label="Remember this device" on />
              <a className="annot" style={{ fontSize: '.82rem' }}>
                Forgot password?
              </a>
            </div>
            <Btn primary onClick={() => go('dashboard')} style={{ width: '100%', justifyContent: 'center', padding: '11px' }}>
              Sign In
            </Btn>
            <div
              className="center"
              style={{ gap: 8, justifyContent: 'center', color: 'var(--ink-faint)', fontSize: '.8rem' }}
            >
              <span className="dot ok" style={{ width: 7, height: 7, borderRadius: '50%' }} /> MFA prompt
              follows sign-in
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 2. INTERNAL DASHBOARD ---------- */
export function DashboardScreen({ go }: ScreenProps) {
  return (
    <div className="col">
      <PageHead
        title="Dashboard"
        sub="Monitor client readiness, risk, evidence, and upcoming deadlines."
        actions={
          <>
            <Btn onClick={() => go('reports')}>Generate Report</Btn>
            <Btn primary onClick={() => go('create-client')}>
              + New Client
            </Btn>
          </>
        }
      />
      <div className="grid-4">
        <StatCard k="Active Clients" v="12" />
        <StatCard k="Avg Readiness" v="58%" d="+4 this mo" tone="ok" />
        <StatCard k="Open POA&Ms" v="47" />
        <StatCard k="Critical Blockers" v="9" d="High" tone="crit" />
      </div>
      <div className="grid-2">
        <Card title="Readiness by Client">
          <BarChart
            rows={[
              { l: 'Bravo Machine', p: 84, v: '84%' },
              { l: 'Acme Defense', p: 62, v: '62%' },
              { l: 'Cobalt Aero', p: 49, v: '49%' },
              { l: 'Delta Systems', p: 20, v: '20%' },
              { l: 'Echo Logistics', p: 71, v: '71%' },
            ]}
          />
        </Card>
        <Card title="Clients at Risk" action={<Btn sm ghost onClick={() => go('clients')}>View all</Btn>}>
          <table className="w-table">
            <tbody>
              <tr onClick={() => go('client-dashboard')}>
                <td>Acme Defense</td>
                <td>
                  <RiskBadge level="High" />
                </td>
                <td className="muted">Missing SSP</td>
              </tr>
              <tr onClick={() => go('client-dashboard')}>
                <td>Delta Systems</td>
                <td>
                  <RiskBadge level="High" />
                </td>
                <td className="muted">Intake incomplete</td>
              </tr>
              <tr onClick={() => go('client-dashboard')}>
                <td>Cobalt Aero</td>
                <td>
                  <RiskBadge level="Medium" />
                </td>
                <td className="muted">Evidence gaps</td>
              </tr>
            </tbody>
          </table>
        </Card>
        <Card title="Upcoming Deadlines">
          <table className="w-table">
            <tbody>
              <tr>
                <td className="mono">Aug 15</td>
                <td>Acme Defense</td>
                <td className="muted">Readiness report due</td>
              </tr>
              <tr>
                <td className="mono">Jul 30</td>
                <td>Bravo Machine</td>
                <td className="muted">Go/No-Go memo</td>
              </tr>
              <tr>
                <td className="mono">Jul 12</td>
                <td>Acme Defense</td>
                <td className="muted">POA&M item due</td>
              </tr>
            </tbody>
          </table>
        </Card>
        <Card title="Recent Activity" action={<Btn sm ghost onClick={() => go('audit')}>Audit log</Btn>}>
          <div className="col" style={{ gap: 11, fontSize: '.92em' }}>
            <div className="center" style={{ gap: 10 }}>
              <span className="dot ok" style={{ width: 9, height: 9, borderRadius: '50%' }} /> Evidence
              uploaded — MFA screenshot{' '}
              <span className="faint mono" style={{ marginLeft: 'auto', fontSize: '.8em' }}>
                9:22
              </span>
            </div>
            <div className="center" style={{ gap: 10 }}>
              <span className="dot ok" style={{ width: 9, height: 9, borderRadius: '50%' }} /> Control
              3.5.3 marked Met{' '}
              <span className="faint mono" style={{ marginLeft: 'auto', fontSize: '.8em' }}>
                9:15
              </span>
            </div>
            <div className="center" style={{ gap: 10 }}>
              <span className="dot warn" style={{ width: 9, height: 9, borderRadius: '50%' }} /> POA&M
              created — CUI flow{' '}
              <span className="faint mono" style={{ marginLeft: 'auto', fontSize: '.8em' }}>
                8:51
              </span>
            </div>
            <div className="center" style={{ gap: 10 }}>
              <span className="dot none" style={{ width: 9, height: 9, borderRadius: '50%' }} /> Report
              generated — Executive{' '}
              <span className="faint mono" style={{ marginLeft: 'auto', fontSize: '.8em' }}>
                8:40
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- 3. CLIENTS LIST ---------- */
const CLIENTS: [string, string, number, string, RiskLevel, string, string, string][] = [
  ['Acme Defense Systems', 'Level 2 · C3PAO', 62, '−38', 'High', 'Evidence', 'Justin', '2d ago'],
  ['Bravo Machine Works', 'Level 1', 84, '+6', 'Medium', 'Report', 'Justin', '1d ago'],
  ['Cobalt Aerospace', 'Level 2 · C3PAO', 49, '−61', 'Medium', 'Controls', 'Dana', '5h ago'],
  ['Delta Systems', 'Unknown', 20, 'TBD', 'High', 'Intake', 'Justin', '3d ago'],
  ['Echo Logistics', 'Level 2 · Self', 71, '−22', 'Low', 'SSP', 'Dana', '6h ago'],
  ['Foxtrot Materials', 'Level 1', 90, '+9', 'Low', 'Report', 'Justin', '1w ago'],
];

export function ClientsScreen({ go }: ScreenProps) {
  return (
    <div className="col">
      <PageHead
        title="Clients"
        sub="Manage all Benchmark Fox readiness engagements."
        actions={
          <Btn primary onClick={() => go('create-client')}>
            + New Client
          </Btn>
        }
      />
      <Toolbar search="Search clients…" filters={['CMMC Level', 'Risk', 'Phase', 'Consultant', 'Status']} />
      <Card style={{ padding: '6px 6px' }}>
        <table className="w-table">
          <thead>
            <tr>
              <th>Client Name</th>
              <th>CMMC Path</th>
              <th>Readiness</th>
              <th>Score</th>
              <th>Risk</th>
              <th>Phase</th>
              <th>Owner</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {CLIENTS.map((c, i) => (
              <tr key={i} onClick={() => go('client-dashboard')}>
                <td style={{ fontWeight: 700 }}>{c[0]}</td>
                <td className="mono" style={{ fontSize: '.85em' }}>
                  {c[1]}
                </td>
                <td>
                  <div className="center" style={{ gap: 8 }}>
                    <span className="bar-track" style={{ width: 60 }}>
                      <span className="bar-fill" style={{ width: c[2] + '%' }} />
                    </span>
                    <span className="mono" style={{ fontSize: '.85em' }}>
                      {c[2]}%
                    </span>
                  </div>
                </td>
                <td className="num">{c[3]}</td>
                <td>
                  <RiskBadge level={c[4]} />
                </td>
                <td className="muted">{c[5]}</td>
                <td>{c[6]}</td>
                <td className="faint mono" style={{ fontSize: '.82em' }}>
                  {c[7]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------- 4. CREATE CLIENT ---------- */
export function CreateClientScreen({ go }: ScreenProps) {
  return (
    <div className="col" style={{ maxWidth: 820 }}>
      <PageHead title="Create New Client" sub="Add basic client and engagement details." />
      <Card title="Company Information">
        <div className="grid-2">
          <Field label="LEGAL COMPANY NAME" placeholder="Acme Defense Systems, LLC" />
          <Field label="DBA / TRADE NAME" placeholder="Acme Defense" />
          <Field label="WEBSITE" placeholder="acmedefense.com" />
          <Field label="PRIMARY LOCATION" placeholder="Huntsville, AL" />
        </div>
      </Card>
      <Card title="Primary Contact">
        <div className="grid-2">
          <Field label="NAME" placeholder="Full name" />
          <Field label="EMAIL" placeholder="contact@client.com" />
          <Field label="PHONE" placeholder="(555) 000-0000" />
          <Field label="TITLE" placeholder="CIO / IT Director" />
        </div>
      </Card>
      <Card title="Engagement">
        <div className="grid-2">
          <Select label="ENGAGEMENT TYPE" value="CMMC Readiness Program" />
          <Select label="ASSIGNED CONSULTANT" value="Justin" />
        </div>
      </Card>
      <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
        <Btn onClick={() => go('clients')}>Save Client</Btn>
        <Btn primary onClick={() => go('intake')}>
          Save and Start Intake
        </Btn>
      </div>
    </div>
  );
}
