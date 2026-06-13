/* ============================================================
   Routes — the route tree (react-router v6), the ScreenKey ↔ path
   mapping, the legacy ?screen= redirect, and the `go` adapter that
   keeps every screen component's existing `go(screenKey)` API working.
   ============================================================ */
import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  generatePath,
  Link,
  matchPath,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import type { Go, NavStyle, ScreenKey, ScreenProps } from './types';
import type { AppRoleEnum } from './lib/database.types';
import { useAuth } from './auth/AuthProvider';
import { Shell } from './components/Shell';
import { useData } from './data/store';
import { clientById, CURRENT_CLIENT_ID } from './data/clients';
import {
  LoginScreen,
  DashboardScreen,
  ClientsScreen,
  CreateClientScreen,
  ClientDashboardScreen,
  IntakeScreen,
  PathScreen,
  ScopeScreen,
  ControlLibraryScreen,
  ControlMatrixScreen,
  ControlDetailScreen,
  SSPScreen,
  POAMScreen,
  EvidenceScreen,
  TasksScreen,
  ReportsScreen,
  ReportPreviewScreen,
  KnowledgeScreen,
  AuditScreen,
  SettingsScreen,
  MobileScreen,
} from './screens';

/* ------------------------------------------------------------
   ScreenKey → route-path mapping. This single table drives:
   - screenPath() (the `go` adapter + legacy ?screen= redirect)
   - screenKeyFromPath() (Shell active state, keyboard stepping)
   It maps every legacy ?screen= key. All 21 legacy keys:
     login, dashboard, clients, create-client, client-dashboard,
     intake, path, scope, control-library, controls, control-detail,
     ssp, poam, evidence, tasks, reports, report-preview, knowledge,
     audit, settings, mobile
   Entry order matters for screenKeyFromPath: routes whose static
   segments collide with a param route (create-client `/clients/new`
   vs client-dashboard `/clients/:clientId`) must come first.
   ------------------------------------------------------------ */
export const SCREEN_ROUTES: Record<ScreenKey, string> = {
  login: '/login',
  dashboard: '/dashboard',
  clients: '/clients',
  'create-client': '/clients/new', // before client-dashboard (static beats :clientId)
  'client-dashboard': '/clients/:clientId',
  intake: '/clients/:clientId/intake',
  path: '/clients/:clientId/path',
  scope: '/clients/:clientId/scope',
  'control-library': '/library',
  controls: '/clients/:clientId/controls',
  'control-detail': '/clients/:clientId/controls/:controlId',
  ssp: '/clients/:clientId/ssp',
  poam: '/clients/:clientId/poam',
  evidence: '/clients/:clientId/evidence',
  tasks: '/clients/:clientId/tasks',
  reports: '/clients/:clientId/reports',
  'report-preview': '/clients/:clientId/reports/preview',
  knowledge: '/knowledge',
  audit: '/audit',
  settings: '/settings',
  mobile: '/mobile',
};

export const isScreenKey = (k: string | null | undefined): k is ScreenKey =>
  !!k && k in SCREEN_ROUTES;

/* The store persists the selection with JSON.stringify; accept both the
   JSON form ("3.1.1" with quotes) and the legacy raw form. */
function loadSelectedControlId(): string {
  const raw = localStorage.getItem('bf_selected_control');
  if (!raw) return '3.1.1'; // store's seed default
  try {
    return JSON.parse(raw) as string;
  } catch {
    return raw;
  }
}

/** Resolve a ScreenKey to a concrete path (client-scoped keys get a clientId). */
export function screenPath(
  key: ScreenKey,
  ctx: { clientId?: string; controlId?: string } = {},
): string {
  return generatePath(SCREEN_ROUTES[key], {
    clientId: ctx.clientId ?? CURRENT_CLIENT_ID,
    controlId: ctx.controlId ?? loadSelectedControlId(),
  });
}

/** Reverse lookup: which ScreenKey does a pathname render? */
export function screenKeyFromPath(pathname: string): ScreenKey | null {
  for (const [key, pattern] of Object.entries(SCREEN_ROUTES) as [ScreenKey, string][]) {
    if (matchPath(pattern, pathname)) return key;
  }
  return null;
}

/* clientId of the route we're on (only if it names a known client). */
function clientIdFromPath(pathname: string): string {
  const m =
    matchPath('/clients/:clientId/*', pathname) ?? matchPath('/clients/:clientId', pathname);
  const id = m?.params.clientId;
  return id && clientById(id) ? id : CURRENT_CLIENT_ID;
}

/* ------------------------------------------------------------
   useGo — adapter that keeps the screens' `go(screenKey)` API:
   navigates to the mapped path (staying in the current client's
   context) and resets scroll, exactly like the old router did.
   For 'control-detail' the target control comes from
   bf_selected_control, which screens set via selectControl() right
   before calling go('control-detail').
   ------------------------------------------------------------ */
export function useGo(): Go {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback(
    (key: ScreenKey) => {
      navigate(screenPath(key, { clientId: clientIdFromPath(pathname) }));
      window.scrollTo(0, 0);
    },
    [navigate, pathname],
  );
}

/* ------------------------------------------------------------
   Route components
   ------------------------------------------------------------ */

/* Dismissible "auth disabled" notice shown on every protected route in
   Local Prototype mode (no Supabase env vars). Dismissal sticks for the
   browser session; fixed bottom-center so no layout shifts. */
const LOCAL_BANNER_DISMISSED_KEY = 'bf_local_banner_dismissed';

function LocalModeBanner() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(LOCAL_BANNER_DISMISSED_KEY) === '1',
  );
  if (dismissed) return null;
  return (
    <div
      role="status"
      className="w-card center"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999,
        gap: 10,
        padding: '8px 10px 8px 14px',
        borderStyle: 'dashed',
        boxShadow: 'var(--sh-md)',
        fontSize: '.85rem',
        whiteSpace: 'nowrap',
      }}
    >
      <span className="dot warn" style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none' }} />
      Local Prototype mode — auth disabled
      <button
        className="w-btn sm"
        aria-label="Dismiss"
        onClick={() => {
          sessionStorage.setItem(LOCAL_BANNER_DISMISSED_KEY, '1');
          setDismissed(true);
        }}
      >
        ✕
      </button>
    </div>
  );
}

/* Minimal full-screen placeholder while the session/profile is restored. */
function AuthPendingScreen() {
  return (
    <div className="center" style={{ minHeight: '100vh', justifyContent: 'center' }}>
      <span className="muted" style={{ fontSize: '.9rem' }}>
        Checking session…
      </span>
    </div>
  );
}

/** Auth guard (Task 03 — Supabase Auth). Wraps every route except /login.
    Local Prototype mode (no Supabase env vars): render freely, with the
    dismissible banner, so demos keep working. Supabase mode: no session →
    redirect to /login, remembering the intended URL so the Login screen can
    return there after sign-in. */
export function ProtectedRoute() {
  const { isConfigured, loading, session } = useAuth();
  const location = useLocation();
  if (!isConfigured) {
    return (
      <>
        <LocalModeBanner />
        <Outlet />
      </>
    );
  }
  if (loading && !session) return <AuthPendingScreen />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Role guard for role-scoped areas (used by later tasks, e.g. the client
    portal). Pass-through in Local Prototype mode; otherwise requires a
    session AND one of the given roles. While the profile row is still
    loading (session-but-no-profile race) it shows the pending screen
    instead of mis-deciding. */
export function RequireRole({
  roles,
  children,
}: {
  roles: readonly AppRoleEnum[];
  children: ReactNode;
}) {
  const { isConfigured, loading, session, role } = useAuth();
  const location = useLocation();
  if (!isConfigured) return <>{children}</>;
  if (loading) return <AuthPendingScreen />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (!role || !roles.includes(role)) {
    return (
      <div className="center" style={{ minHeight: '60vh', justifyContent: 'center', padding: 24 }}>
        <div className="w-card col" style={{ maxWidth: 440, padding: 28, gap: 12, textAlign: 'center' }}>
          <h1 className="w-h1">No access</h1>
          <p className="muted" style={{ margin: 0 }}>
            Your account doesn&rsquo;t have access to this area. Contact a Benchmark Fox
            administrator if you believe that&rsquo;s wrong.
          </p>
          <Link to="/dashboard" className="w-btn primary" style={{ justifyContent: 'center' }}>
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/* Layout route: app shell (sidebar/topnav/hybrid) around every screen
   except the full-bleed ones (login, mobile). */
function ShellLayout({ navStyle }: { navStyle: NavStyle }) {
  const go = useGo();
  const { pathname } = useLocation();
  return (
    <Shell screen={screenKeyFromPath(pathname) ?? 'dashboard'} go={go} navStyle={navStyle}>
      <Outlet />
    </Shell>
  );
}

/* Thin wrapper: hands the route-context `go` to an unchanged screen. */
function ScreenRoute({ component: C }: { component: ComponentType<ScreenProps> }) {
  const go = useGo();
  return <C go={go} />;
}

/* Validates :clientId against the seed clients; unknown ids → /clients. */
function ClientScope() {
  const { clientId } = useParams();
  if (!clientId || !clientById(clientId)) return <Navigate to="/clients" replace />;
  return <Outlet />;
}

/* Reads :controlId and passes it down; mirrors it into the store so
   bf_selected_control stays in sync and the SSP/Evidence/POA&M panels
   that still follow the selected control don't break. */
function ControlDetailRoute() {
  const go = useGo();
  const { controlId = '' } = useParams();
  const { selectedControlId, selectControl } = useData();
  useEffect(() => {
    if (controlId && controlId !== selectedControlId) selectControl(controlId);
  }, [controlId, selectedControlId, selectControl]);
  return <ControlDetailScreen go={go} controlId={controlId} />;
}

/* Backward compatibility for the published demo links: maps legacy
   /?screen=<key> URLs onto the new paths (see SCREEN_ROUTES above for
   the full 21-key mapping). Without a ?screen= param, `/` restores the
   last visited screen (bf_screen) like the old router, else /login. */
export function LegacyScreenRedirect() {
  const [params] = useSearchParams();
  const legacy = params.get('screen');
  if (isScreenKey(legacy)) return <Navigate to={screenPath(legacy)} replace />;
  const stored = localStorage.getItem('bf_screen');
  return <Navigate to={screenPath(isScreenKey(stored) ? stored : 'login')} replace />;
}

function NotFoundScreen() {
  return (
    <div className="center" style={{ minHeight: '100vh', justifyContent: 'center', padding: 24 }}>
      <div className="w-card col" style={{ maxWidth: 440, padding: 28, gap: 12, textAlign: 'center' }}>
        <h1 className="w-h1">Page not found</h1>
        <p className="muted" style={{ margin: 0 }}>
          This URL doesn&rsquo;t match any screen in the Readiness Portal.
        </p>
        <Link to="/dashboard" className="w-btn primary" style={{ justifyContent: 'center' }}>
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   The route tree
   ------------------------------------------------------------ */
export function AppRoutes({ navStyle }: { navStyle: NavStyle }) {
  return (
    <Routes>
      {/* full-bleed, unauthenticated */}
      <Route path="/login" element={<ScreenRoute component={LoginScreen} />} />

      <Route element={<ProtectedRoute />}>
        {/* full-bleed (no shell) */}
        <Route path="/mobile" element={<ScreenRoute component={MobileScreen} />} />

        <Route element={<ShellLayout navStyle={navStyle} />}>
          <Route path="/dashboard" element={<ScreenRoute component={DashboardScreen} />} />
          <Route path="/clients" element={<ScreenRoute component={ClientsScreen} />} />
          <Route path="/clients/new" element={<ScreenRoute component={CreateClientScreen} />} />
          <Route path="/clients/:clientId" element={<ClientScope />}>
            <Route index element={<ScreenRoute component={ClientDashboardScreen} />} />
            <Route path="intake" element={<ScreenRoute component={IntakeScreen} />} />
            <Route path="path" element={<ScreenRoute component={PathScreen} />} />
            <Route path="scope" element={<ScreenRoute component={ScopeScreen} />} />
            <Route path="controls" element={<ScreenRoute component={ControlMatrixScreen} />} />
            <Route path="controls/:controlId" element={<ControlDetailRoute />} />
            <Route path="ssp" element={<ScreenRoute component={SSPScreen} />} />
            <Route path="poam" element={<ScreenRoute component={POAMScreen} />} />
            <Route path="evidence" element={<ScreenRoute component={EvidenceScreen} />} />
            <Route path="tasks" element={<ScreenRoute component={TasksScreen} />} />
            <Route path="reports" element={<ScreenRoute component={ReportsScreen} />} />
            <Route path="reports/preview" element={<ScreenRoute component={ReportPreviewScreen} />} />
          </Route>
          <Route path="/library" element={<ScreenRoute component={ControlLibraryScreen} />} />
          <Route path="/knowledge" element={<ScreenRoute component={KnowledgeScreen} />} />
          <Route path="/audit" element={<ScreenRoute component={AuditScreen} />} />
          <Route path="/settings" element={<ScreenRoute component={SettingsScreen} />} />
        </Route>
      </Route>

      <Route path="/" element={<LegacyScreenRedirect />} />
      <Route path="*" element={<NotFoundScreen />} />
    </Routes>
  );
}
