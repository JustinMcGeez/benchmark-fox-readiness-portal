/* ============================================================
   Screens — core: Login, Internal Dashboard, Clients, Create Client
   ============================================================ */
import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ScreenProps } from '../types';
import type {
  ClientControlAssessment,
  CmmcPathValue,
  DibRole,
  ReadinessStatus,
} from '../data/types';
import { ShieldCheck } from 'lucide-react';
import { signInErrorMessage, useAuth } from '../auth/AuthProvider';
import {
  Badge,
  BarChart,
  Btn,
  Card,
  Check,
  Field,
  PageHead,
  RiskBadge,
  StatCard,
  Toolbar,
  WarnBanner,
} from '../components/primitives';
import { BrandLockup, BrandLogo } from '../components/Brand';
import { AUDIT_EVENTS, CLIENTS, DEMO_CLIENT_ID } from '../data/clients';
import { POAM_ITEMS } from '../data/poam';
import { useData } from '../data/store';
import { useClients } from '../data/clientsStore';
import { useReference } from '../data/referenceStore';
import { formatScore, readinessPct, sprsScore } from '../lib/scoring';
import { blockerItems, openPoamItems } from '../lib/selectors';

/* Client management (create/archive) is admin-only in Supabase mode; in Local
   Prototype mode (no auth) it is always available so demos can show the flow. */
function useCanManageClients(): boolean {
  const { isConfigured, role } = useAuth();
  return !isConfigured || role === 'benchmark_fox_admin';
}

/* Build scoring-shaped rows from per-client readiness statuses (status +
   controlId are all the scoring engine reads; other fields are placeholders). */
function toScoringAssessments(
  statuses: { controlId: string; status: ReadinessStatus }[],
): ClientControlAssessment[] {
  return statuses.map((s) => ({
    clientId: '',
    controlId: s.controlId,
    status: s.status,
    sspStatus: 'Not Reviewed',
    evidenceStatus: 'Not Requested',
    poamStatus: 'None',
    risk: 'Medium',
    owner: 'Unassigned',
  }));
}

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
  const canManage = useCanManageClients();

  // active client computes live; others use their seed summary
  const activeReadiness = readinessPct(assessments);
  const activeScore = sprsScore(assessments, controlsById);
  const clientReadiness = (id: string, fallback: number) =>
    id === DEMO_CLIENT_ID ? activeReadiness : fallback;

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
            {canManage && (
              <Btn primary onClick={() => go('create-client')}>
                + New Client
              </Btn>
            )}
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
  const navigate = useNavigate();
  const { clients, assessmentStatusesByClientId, loading, error, archiveClient } = useClients();
  const { controlsById } = useReference();
  const canManage = useCanManageClients();
  const colSpan = canManage ? 9 : 8;

  return (
    <div className="col">
      <PageHead
        title="Clients"
        sub="Manage all Benchmark Fox readiness engagements."
        actions={
          canManage ? (
            <Btn primary onClick={() => go('create-client')}>
              + New Client
            </Btn>
          ) : undefined
        }
      />
      <Toolbar search="Search clients…" filters={['CMMC Level', 'Risk', 'Phase', 'Consultant', 'Status']} />
      {error && <WarnBanner tone="bad">{error}</WarnBanner>}
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
              <th>Status</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              // Live readiness/SPRS computed from the client's REAL assessments.
              const statuses = assessmentStatusesByClientId[c.id] ?? [];
              const started = statuses.some((s) => s.status !== 'Not Reviewed');
              const asmts = toScoringAssessments(statuses);
              const readiness = readinessPct(asmts);
              const score = formatScore(sprsScore(asmts, controlsById));
              const closed = c.status === 'Closed';
              return (
                <tr
                  key={c.id}
                  onClick={() => navigate('/clients/' + c.id)}
                  style={{ opacity: closed ? 0.62 : 1 }}
                >
                  <td style={{ fontWeight: 700 }}>{c.name}</td>
                  <td className="mono" style={{ fontSize: '.85em' }}>
                    {c.cmmcPath}
                  </td>
                  <td>
                    {started ? (
                      <div className="center" style={{ gap: 8 }}>
                        <span className="bar-track" style={{ width: 60 }}>
                          <span className="bar-fill" style={{ width: readiness + '%' }} />
                        </span>
                        <span className="mono" style={{ fontSize: '.85em' }}>
                          {readiness}%
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
                      <span className="muted" style={{ fontSize: '.85em' }} title="No reviewed controls yet">
                        Not started
                      </span>
                    )}
                  </td>
                  <td className="num">{started ? score : <span className="faint">—</span>}</td>
                  <td>{c.riskRating ? <RiskBadge level={c.riskRating} /> : <span className="faint">—</span>}</td>
                  <td className="muted">{c.readinessPhase}</td>
                  <td>{c.owner || <span className="faint">—</span>}</td>
                  <td>
                    <Badge tone={closed ? 'none' : 'ok'}>{c.status}</Badge>
                  </td>
                  {canManage && (
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      {!closed && (
                        <Btn sm ghost onClick={() => void archiveClient(c.id)}>
                          Archive
                        </Btn>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="muted" style={{ padding: 18, textAlign: 'center' }}>
                  {loading ? 'Loading clients…' : 'No clients yet. Create your first engagement.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------- 4. CREATE CLIENT (multi-step wizard) ---------- */
const WIZARD_STEPS = ['Organization', 'CMMC Target', 'Primary Contact', 'Assignment', 'Review'];
const CMMC_PATH_OPTIONS: CmmcPathValue[] = ['Level 1', 'Level 2', 'Undetermined'];
const DIB_ROLE_OPTIONS: DibRole[] = ['Prime', 'Subcontractor', 'Both', 'Unknown'];
const CONTRACT_TYPE_OPTIONS = [
  'FAR 52.204-21',
  'DFARS 252.204-7012',
  'DFARS 252.204-7019',
  'DFARS 252.204-7020',
  'DFARS 252.204-7021',
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateClientScreen({ go }: ScreenProps) {
  const navigate = useNavigate();
  const { clients, assignableConsultants, createClient } = useClients();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [cageCode, setCageCode] = useState('');
  const [dibRole, setDibRole] = useState<DibRole>('Unknown');
  const [contractTypes, setContractTypes] = useState<string[]>(['DFARS 252.204-7012']);
  const [cmmcPath, setCmmcPath] = useState<CmmcPathValue>('Level 2');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [consultantId, setConsultantId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const nameError = trimmedName.length === 0;
  const duplicate =
    !nameError && clients.some((c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase());
  const emailEntered = contactEmail.trim().length > 0;
  const emailError = emailEntered && !EMAIL_RE.test(contactEmail.trim());

  const toggleContract = (label: string) =>
    setContractTypes((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );

  const last = step === WIZARD_STEPS.length - 1;
  const canAdvance = (step === 0 ? !nameError : true) && (step === 2 ? !emailError : true);
  const canCreate = !nameError && !emailError && !submitting;

  const onCreate = async () => {
    if (!canCreate) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const record = await createClient({
        name: trimmedName,
        cmmcPath,
        cageCode: cageCode.trim() || undefined,
        dibRole,
        contractTypes,
        primaryContactName: contactName.trim() || undefined,
        primaryContactEmail: contactEmail.trim() || undefined,
        primaryContactTitle: contactTitle.trim() || undefined,
        primaryConsultantId: consultantId || undefined,
      });
      navigate('/clients/' + record.id);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not create the client. Please try again.');
      setSubmitting(false);
    }
  };

  const consultantName =
    assignableConsultants.find((c) => c.id === consultantId)?.name ?? 'Unassigned';

  return (
    <div className="col" style={{ maxWidth: 820 }}>
      <PageHead title="Create New Client" sub="Add a new CMMC readiness engagement." />
      <Card>
        <div className="w-steps" style={{ marginBottom: 18 }}>
          {WIZARD_STEPS.map((s, i) => (
            <Fragment key={s}>
              <span
                className={'w-step' + (i === step ? ' on' : i < step ? ' done' : '')}
                onClick={() => setStep(i)}
                style={{ cursor: 'pointer' }}
              >
                <span className="n">{i < step ? '✓' : i + 1}</span>
                <span className={'lbl' + (i === step ? ' cur' : '')}>{s}</span>
              </span>
              {i < WIZARD_STEPS.length - 1 && <span className="w-step-line" />}
            </Fragment>
          ))}
        </div>
        <div className="mono faint" style={{ fontSize: '.78em', marginBottom: 14 }}>
          STEP {step + 1} OF {WIZARD_STEPS.length}
        </div>

        {step === 0 && (
          <div className="col" style={{ gap: 14 }}>
            <div className="grid-2">
              <Field
                label="LEGAL COMPANY NAME"
                name="client-name"
                placeholder="Acme Defense Systems, LLC"
                value={name}
                onChange={setName}
              />
              <Field
                label="CAGE CODE (OPTIONAL)"
                name="client-cage"
                placeholder="1ABC2"
                value={cageCode}
                onChange={setCageCode}
              />
            </div>
            {nameError && (
              <span className="annot" style={{ color: '#a23a20' }}>
                Company name is required.
              </span>
            )}
            {duplicate && (
              <WarnBanner tone="warn">
                A client named “{trimmedName}” already exists. You can still continue if this is a
                separate engagement.
              </WarnBanner>
            )}
            <div className="w-field" style={{ maxWidth: 320 }}>
              <label className="w-label" htmlFor="client-dib">
                DIB ROLE
              </label>
              <select
                id="client-dib"
                className="w-input"
                value={dibRole}
                onChange={(e) => setDibRole(e.target.value as DibRole)}
              >
                {DIB_ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="col" style={{ gap: 8 }}>
              <span className="muted">Applicable contract clauses</span>
              <div className="grid-2">
                {CONTRACT_TYPE_OPTIONS.map((label) => (
                  <span key={label} onClick={() => toggleContract(label)} style={{ cursor: 'pointer' }}>
                    <Check label={label} on={contractTypes.includes(label)} />
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="col" style={{ gap: 12 }}>
            <span className="muted">Target CMMC level for this engagement</span>
            <div className="row gap-sm wrap">
              {CMMC_PATH_OPTIONS.map((p) => (
                <span key={p} onClick={() => setCmmcPath(p)} style={{ cursor: 'pointer' }}>
                  <Check radio label={p} on={cmmcPath === p} />
                </span>
              ))}
            </div>
            <p className="annot" style={{ margin: 0 }}>
              The final path is confirmed during intake and scoping — this sets the starting target.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="grid-2">
            <Field
              label="CONTACT NAME"
              name="contact-name"
              placeholder="Full name"
              value={contactName}
              onChange={setContactName}
            />
            <Field
              label="CONTACT EMAIL"
              name="contact-email"
              type="email"
              placeholder="contact@client.com"
              value={contactEmail}
              onChange={setContactEmail}
            />
            <Field
              label="CONTACT TITLE"
              name="contact-title"
              placeholder="CIO / IT Director"
              value={contactTitle}
              onChange={setContactTitle}
            />
            {emailError && (
              <span className="annot" style={{ color: '#a23a20', alignSelf: 'flex-end' }}>
                Enter a valid email address.
              </span>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="col" style={{ gap: 12 }}>
            <span className="muted">Initial consultant assignment</span>
            <div className="w-field" style={{ maxWidth: 380 }}>
              <label className="w-label" htmlFor="client-consultant">
                ASSIGNED CONSULTANT
              </label>
              <select
                id="client-consultant"
                className="w-input"
                value={consultantId}
                onChange={(e) => setConsultantId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {assignableConsultants.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.role}
                  </option>
                ))}
              </select>
            </div>
            <p className="annot" style={{ margin: 0 }}>
              Consultants only see clients they are assigned to. You can change assignments later.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="w-box fill" style={{ padding: 18 }}>
            <span className="w-eyebrow">Review</span>
            <div className="grid-2 mt" style={{ gap: 10 }}>
              {(
                [
                  ['Company name', trimmedName || '—'],
                  ['CAGE code', cageCode.trim() || '—'],
                  ['DIB role', dibRole],
                  ['Target CMMC', cmmcPath],
                  ['Contract clauses', contractTypes.length ? contractTypes.join(', ') : 'None'],
                  ['Primary contact', contactName.trim() || '—'],
                  ['Contact email', contactEmail.trim() || '—'],
                  ['Assigned consultant', consultantName],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div
                  key={k}
                  className="between w-box"
                  style={{ padding: '8px 12px', background: 'var(--white)', gap: 10 }}
                >
                  <span className="muted">{k}</span>
                  <span style={{ textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
            {duplicate && (
              <WarnBanner tone="warn">
                A client named “{trimmedName}” already exists — continuing will create a separate
                engagement.
              </WarnBanner>
            )}
            <p className="annot" style={{ marginTop: 10 }}>
              Creating the client seeds all 110 NIST SP 800-171 control assessments as “Not
              Reviewed”.
            </p>
          </div>
        )}

        <hr className="w-hr" />
        {submitError && (
          <div role="alert" className="center" style={{ gap: 8, fontSize: '.85rem', color: '#a23a20' }}>
            <span className="dot bad" style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none' }} />
            {submitError}
          </div>
        )}
        <div className="between">
          <Btn ghost onClick={() => (step > 0 ? setStep(step - 1) : go('clients'))}>
            ← Back
          </Btn>
          {last ? (
            <Btn primary onClick={onCreate} disabled={!canCreate}>
              {submitting ? 'Creating…' : 'Create Client'}
            </Btn>
          ) : (
            <Btn primary onClick={() => canAdvance && setStep(step + 1)} disabled={!canAdvance}>
              Next →
            </Btn>
          )}
        </div>
      </Card>
    </div>
  );
}
