/* ============================================================
   Screens — core: Login, Internal Dashboard, Clients, Create Client
   ============================================================ */
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ScreenProps } from '../types';
import { ShieldCheck } from 'lucide-react';
import { signInErrorMessage, useAuth } from '../auth/AuthProvider';
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
import { AUDIT_EVENTS, CLIENTS, CURRENT_CLIENT_ID } from '../data/clients';
import { POAM_ITEMS } from '../data/poam';
import { useData } from '../data/store';
import { useReference } from '../data/referenceStore';
import { formatScore, readinessPct, sprsScore } from '../lib/scoring';
import { blockerItems, openPoamItems } from '../lib/selectors';

const RISK_REASON: Record<string, string> = {
  Intake: 'Intake incomplete',
  Controls: 'Control gaps',
  Evidence: 'Evidence gaps',
  SSP: 'SSP in progress',
  Report: 'Report pending',
};
const activityTone = (action: string): 'ok' | 'warn' | 'none' => {
  if (/accepted|uploaded|met|complete/i.test(action)) return 'ok';
  if (/created|changed|updated/i.test(action)) return 'warn';
  return 'none';
};

/* ---------- 1. LOGIN ---------- */

/* The real sign-in card (Supabase configured): email+password or magic link,
   inline generic errors, return-to-intended-destination after login. */
function SignInCard() {
  const { signInWithPassword, signInWithMagicLink, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'password' | 'magic-link'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* ProtectedRoute stashes the originally requested URL in location.state.
     Only in-app absolute paths are honored ('/x' but not '//x'), so a forged
     history state can never redirect outside the app. */
  const from = (location.state as { from?: string } | null)?.from;
  const safeFrom = from && from.startsWith('/') && !from.startsWith('//') ? from : null;
  const destination = safeFrom && safeFrom !== '/login' ? safeFrom : '/dashboard';

  /* Already signed in (restored session, or magic-link landing): continue. */
  useEffect(() => {
    if (session) navigate(destination, { replace: true });
  }, [session, destination, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setNotice(null);
    const address = email.trim();
    if (mode === 'password') {
      if (!address || !password) {
        setError('Enter your email and password.');
        return;
      }
      setSubmitting(true);
      const result = await signInWithPassword(address, password);
      setSubmitting(false);
      if (!result.ok) {
        setError(signInErrorMessage(result.error));
        return;
      }
      navigate(destination, { replace: true });
    } else {
      if (!address) {
        setError('Enter your email address.');
        return;
      }
      setSubmitting(true);
      const result = await signInWithMagicLink(address);
      setSubmitting(false);
      if (!result.ok) {
        setError(signInErrorMessage(result.error));
        return;
      }
      // Neutral on purpose — never confirms whether the address is registered.
      setNotice('If an account exists for that address, a sign-in link is on its way. Check your inbox.');
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'password' ? 'magic-link' : 'password'));
    setError(null);
    setNotice(null);
  };

  return (
    <form className="w-card col" style={{ textAlign: 'left', gap: 16 }} onSubmit={submit}>
      <Field
        label="Email address"
        placeholder="you@benchmarkfox.com"
        type="email"
        name="email"
        autoComplete="email"
        disabled={submitting}
        value={email}
        onChange={setEmail}
      />
      {mode === 'password' && (
        <Field
          label="Password"
          placeholder="••••••••"
          type="password"
          name="password"
          autoComplete="current-password"
          disabled={submitting}
          value={password}
          onChange={setPassword}
        />
      )}
      {error && (
        <div role="alert" className="center" style={{ gap: 8, fontSize: '.85rem', color: '#a23a20' }}>
          <span className="dot bad" style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none' }} />
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="center" style={{ gap: 8, fontSize: '.85rem', color: 'var(--ink-soft)' }}>
          <span className="dot ok" style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none' }} />
          {notice}
        </div>
      )}
      {mode === 'password' && (
        <div className="between">
          <Check label="Remember this device" on />
          <a className="annot" style={{ fontSize: '.82rem' }}>
            Forgot password?
          </a>
        </div>
      )}
      <Btn
        primary
        type="submit"
        disabled={submitting}
        style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
      >
        {mode === 'password'
          ? submitting
            ? 'Signing In…'
            : 'Sign In'
          : submitting
            ? 'Sending…'
            : 'Send Magic Link'}
      </Btn>
      <a
        className="annot"
        onClick={switchMode}
        style={{ fontSize: '.82rem', textAlign: 'center', cursor: 'pointer' }}
      >
        {mode === 'password' ? 'Email me a magic link instead' : 'Use password instead'}
      </a>
      <div
        className="center"
        style={{ gap: 8, justifyContent: 'center', color: 'var(--ink-faint)', fontSize: '.8rem' }}
      >
        <span className="dot ok" style={{ width: 7, height: 7, borderRadius: '50%' }} />
        {mode === 'password' ? 'MFA prompt follows sign-in' : 'One-time sign-in link, no password needed'}
      </div>
    </form>
  );
}

/* Local Prototype mode keeps the original non-functional demo card exactly. */
function DemoSignInCard({ go }: ScreenProps) {
  return (
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
  );
}

export function LoginScreen({ go }: ScreenProps) {
  const { isConfigured } = useAuth();
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
          {isConfigured ? <SignInCard /> : <DemoSignInCard go={go} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- 2. INTERNAL DASHBOARD ---------- */
export function DashboardScreen({ go }: ScreenProps) {
  const { assessments } = useData();
  const { controlsById } = useReference();

  // active client computes live; others use their seed summary
  const activeReadiness = readinessPct(assessments);
  const activeScore = sprsScore(assessments, controlsById);
  const clientReadiness = (id: string, fallback: number) =>
    id === 'acme' ? activeReadiness : fallback;

  const activeClients = CLIENTS.filter((c) => c.active);
  const avgReadiness = Math.round(
    activeClients.reduce((s, c) => s + clientReadiness(c.id, c.readiness), 0) / activeClients.length,
  );
  const openPoam = openPoamItems(POAM_ITEMS).length;
  const blockers = blockerItems(POAM_ITEMS).length;

  const readinessByClient = [...activeClients]
    .map((c) => ({ name: c.name, r: clientReadiness(c.id, c.readiness) }))
    .sort((a, b) => b.r - a.r)
    .slice(0, 5);

  const atRisk = activeClients
    .filter((c) => c.riskRating === 'High' || c.riskRating === 'Medium')
    .slice(0, 3);

  const deadlines = activeClients.filter((c) => c.deadline).slice(0, 3);

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
        <StatCard k="Active Clients" v={activeClients.length} />
        <StatCard k="Avg Readiness" v={`${avgReadiness}%`} tone="ok" />
        <StatCard k="Open POA&Ms" v={openPoam} />
        <StatCard k="Critical Blockers" v={blockers} d="High" tone="crit" />
      </div>
      <div className="grid-2">
        <Card title="Readiness by Client">
          <BarChart
            rows={readinessByClient.map((c) => ({
              l: c.name.split(' ').slice(0, 2).join(' '),
              p: c.r,
              v: `${c.r}%`,
            }))}
          />
        </Card>
        <Card title="Clients at Risk" action={<Btn sm ghost onClick={() => go('clients')}>View all</Btn>}>
          <table className="w-table">
            <tbody>
              {atRisk.map((c) => (
                <tr key={c.id} onClick={() => go('client-dashboard')}>
                  <td>{c.name.split(' ').slice(0, 2).join(' ')}</td>
                  <td>
                    <RiskBadge level={c.riskRating} />
                  </td>
                  <td className="muted">{RISK_REASON[c.phase] ?? c.phase}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Upcoming Deadlines">
          <table className="w-table">
            <tbody>
              {deadlines.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.deadline}</td>
                  <td>{c.name.split(' ').slice(0, 2).join(' ')}</td>
                  <td className="muted">Engagement deadline</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Recent Activity" action={<Btn sm ghost onClick={() => go('audit')}>Audit log</Btn>}>
          <div className="col" style={{ gap: 11, fontSize: '.92em' }}>
            {AUDIT_EVENTS.slice(0, 4).map((e) => (
              <div key={e.id} className="center" style={{ gap: 10 }}>
                <span
                  className={'dot ' + activityTone(e.action)}
                  style={{ width: 9, height: 9, borderRadius: '50%' }}
                />
                {e.action} — {e.details}
                <span className="faint mono" style={{ marginLeft: 'auto', fontSize: '.8em' }}>
                  {e.timestamp.split(' ')[1]}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <span className="mono faint" style={{ fontSize: '.78rem' }}>
        ACTIVE CLIENT · ACME DEFENSE · {activeReadiness}% READY · SCORE {formatScore(activeScore)}
      </span>
    </div>
  );
}

/* ---------- 3. CLIENTS LIST ---------- */
export function ClientsScreen({ go }: ScreenProps) {
  const { assessments } = useData();
  const { controlsById } = useReference();
  // Only the active client has assessment data; its readiness/score compute live.
  // Other clients have no assessments, so we show an honest placeholder instead of
  // presenting seed numbers as if they were computed.
  const liveReadiness = readinessPct(assessments);
  const liveScore = formatScore(sprsScore(assessments, controlsById));
  const placeholderFor = (c: (typeof CLIENTS)[number]) =>
    c.phase === 'Intake' || c.cmmcPath === 'Unknown' ? 'Not started' : 'Seed summary only';
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
            {CLIENTS.map((c) => {
              const live = c.id === CURRENT_CLIENT_ID;
              return (
              <tr key={c.id} onClick={() => go('client-dashboard')}>
                <td style={{ fontWeight: 700 }}>{c.name}</td>
                <td className="mono" style={{ fontSize: '.85em' }}>
                  {c.cmmcPath}
                </td>
                <td>
                  {live ? (
                    <div className="center" style={{ gap: 8 }}>
                      <span className="bar-track" style={{ width: 60 }}>
                        <span className="bar-fill" style={{ width: liveReadiness + '%' }} />
                      </span>
                      <span className="mono" style={{ fontSize: '.85em' }}>
                        {liveReadiness}%
                      </span>
                      <span
                        className="mono faint"
                        title="Computed from assessments"
                        style={{ fontSize: '.6rem', textTransform: 'uppercase', letterSpacing: '.04em' }}
                      >
                        live
                      </span>
                    </div>
                  ) : (
                    <span className="muted" style={{ fontSize: '.85em' }} title="No assessment data yet">
                      {placeholderFor(c)}
                    </span>
                  )}
                </td>
                <td className="num">
                  {live ? liveScore : <span className="faint">—</span>}
                </td>
                <td>
                  <RiskBadge level={c.riskRating} />
                </td>
                <td className="muted">{c.phase}</td>
                <td>{c.owner}</td>
                <td className="faint mono" style={{ fontSize: '.82em' }}>
                  {c.lastUpdated}
                </td>
              </tr>
              );
            })}
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
