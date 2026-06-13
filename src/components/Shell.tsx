/* ============================================================
   APP SHELL — three navigation variations (sidebar / topnav / hybrid)
   plus the client-context tab strip. Navy brand chrome.
   ============================================================ */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  BookOpen,
  CheckSquare,
  ChevronRight,
  FileText,
  Flag,
  LayoutGrid,
  ListChecks,
  Search,
  Settings as SettingsIcon,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Go, NavStyle, ScreenKey } from '../types';
import { ROLE_LABELS, useAuth } from '../auth/AuthProvider';
import { isClientRole } from '../auth/roles';
import { Badge, Btn, RiskBadge } from './primitives';
import { BrandLockup, BrandMark } from './Brand';
import { useCurrentClient } from '../data/clientsStore';

const PRIMARY_NAV: [ScreenKey, string, LucideIcon][] = [
  ['dashboard', 'Dashboard', LayoutGrid],
  ['clients', 'Clients', Users],
  ['control-library', 'Control Library', Shield],
  ['evidence', 'Evidence', FileText],
  ['poam', 'POA&M', Flag],
  ['tasks', 'Tasks', CheckSquare],
  ['reports', 'Reports', ListChecks],
  ['knowledge', 'Knowledge Base', BookOpen],
  ['audit', 'Audit Log', Activity],
  ['settings', 'Settings', SettingsIcon],
];

/* Reduced navigation shown to client-portal roles (Task 11): no clients list,
   audit, settings, internal dashboard, intake/scope/tasks, or control library. */
const PORTAL_NAV: [ScreenKey, string, LucideIcon][] = [
  ['client-dashboard', 'Dashboard', LayoutGrid],
  ['controls', 'Controls', Shield],
  ['evidence', 'Evidence', FileText],
  ['reports', 'Documents', ListChecks],
  ['knowledge', 'Knowledge', BookOpen],
];

/* which screens belong to a client context (show client tab strip) */
const CLIENT_TAB: [string, string][] = [
  ['client-dashboard', 'Client Dashboard'],
  ['intake', 'Intake'],
  ['scope', 'Scope'],
  ['controls', 'Controls'],
  ['ssp', 'SSP'],
  ['poam-c', 'POA&M'],
  ['evidence-c', 'Evidence'],
  ['tasks-c', 'Tasks'],
  ['reports-c', 'Reports'],
  ['audit', 'Activity'],
];

/* map client-tab keys → actual screen renderers */
const CLIENT_TAB_SCREEN: Record<string, ScreenKey> = {
  'poam-c': 'poam',
  'evidence-c': 'evidence',
  'tasks-c': 'tasks',
  'reports-c': 'reports',
};

const CLIENT_SCREENS: ScreenKey[] = [
  'client-dashboard',
  'intake',
  'path',
  'scope',
  'controls',
  'control-detail',
  'ssp',
  'poam',
  'evidence',
  'tasks',
  'reports',
  'report-preview',
];

/* user menu (Task 03): signed-in email + role badge + Sign out. In Local
   Prototype mode there is no session, so it shows "Demo user". Keeps the
   original avatar-circle + name look in the navy top bar. */
function UserMenu() {
  const { isConfigured, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const email = session?.user?.email ?? '';
  const displayName = !isConfigured ? 'Demo user' : profile?.fullName || email || 'Signed in';
  const initial = (displayName.trim().charAt(0) || 'U').toUpperCase();

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut(); // clears ONLY Supabase auth state — bf_* demo keys stay
    setSigningOut(false);
    setOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="User menu"
        aria-expanded={open}
        style={{
          appearance: 'none',
          border: 0,
          background: 'transparent',
          padding: 0,
          font: 'inherit',
          cursor: 'pointer',
        }}
      >
        <span className="center" style={{ gap: 9, color: 'var(--navy-ink)' }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'rgba(255,255,255,.12)',
              border: '1px solid rgba(255,255,255,.22)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '.8rem',
              fontWeight: 700,
              fontFamily: 'var(--head)',
            }}
          >
            {initial}
          </span>
          <span style={{ fontSize: '.88rem', fontWeight: 600 }} className="hide-narrow">
            {displayName}
          </span>
        </span>
      </button>
      {open && (
        <>
          {/* click-away layer */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1002 }} />
          <div
            className="w-card col"
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              right: 0,
              zIndex: 1003,
              minWidth: 230,
              padding: 14,
              gap: 10,
              boxShadow: 'var(--sh-md)',
              textAlign: 'left',
              color: 'var(--ink)',
            }}
          >
            {isConfigured ? (
              <>
                <div className="col" style={{ gap: 3 }}>
                  <span style={{ fontSize: '.88rem', fontWeight: 600 }}>{displayName}</span>
                  {email && (
                    <span className="mono muted" style={{ fontSize: '.78rem' }}>
                      {email}
                    </span>
                  )}
                </div>
                <div>
                  {role ? (
                    <Badge tone="none">{ROLE_LABELS[role]}</Badge>
                  ) : (
                    <Badge tone="warn">No role assigned</Badge>
                  )}
                </div>
                <Btn sm onClick={onSignOut} disabled={signingOut} style={{ justifyContent: 'center' }}>
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </Btn>
              </>
            ) : (
              <>
                <span style={{ fontSize: '.88rem', fontWeight: 600 }}>Demo user</span>
                <span className="muted" style={{ fontSize: '.8rem' }}>
                  Local Prototype mode — auth disabled
                </span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* shared top-bar right cluster: search + notifications + profile */
function TopActions({ compact = false }: { compact?: boolean }) {
  return (
    <div className="center" style={{ gap: compact ? 14 : 18 }}>
      {!compact && (
        <div
          className="center"
          style={{
            gap: 8,
            color: 'rgba(243,246,251,.7)',
            border: '1px solid rgba(255,255,255,.16)',
            borderRadius: 8,
            padding: '7px 12px',
            fontSize: '.85rem',
            minWidth: 220,
          }}
        >
          <Search size={15} strokeWidth={2} />
          <span>Search clients, controls…</span>
        </div>
      )}
      <Bell size={18} strokeWidth={2} style={{ color: 'rgba(243,246,251,.78)' }} />
      <UserMenu />
    </div>
  );
}

export function Shell({
  screen,
  go,
  navStyle,
  children,
}: {
  screen: ScreenKey;
  go: Go;
  navStyle: NavStyle;
  children: ReactNode;
}) {
  const { role } = useAuth();
  const portal = isClientRole(role);
  const inClient = CLIENT_SCREENS.includes(screen);
  const currentClient = useCurrentClient();
  const nav = portal ? PORTAL_NAV : PRIMARY_NAV;

  const primaryActive = (key: ScreenKey) => {
    if (portal) {
      if (key === 'controls' && screen === 'control-detail') return true;
      if (key === 'reports' && screen === 'report-preview') return true;
      return key === screen;
    }
    if (key === 'clients' && inClient) return true;
    if (key === 'control-library' && (screen === 'controls' || screen === 'control-detail'))
      return true;
    return key === screen;
  };

  /* "Client Portal" identity strip (replaces the search box / READINESS PORTAL
     eyebrow for client-role sessions, so screenshots are unambiguous). */
  const portalTag = (
    <span className="center" style={{ gap: 10 }}>
      <Badge tone="ok">Client Portal</Badge>
      <span style={{ fontFamily: 'var(--head)', fontWeight: 700, fontSize: '.95rem', color: 'var(--navy-ink)' }}>
        {currentClient?.name ?? 'Your engagement'}
      </span>
    </span>
  );

  const SideNav = (
    <nav
      style={{
        gridArea: 'side',
        background: 'var(--navy)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,.06)',
      }}
    >
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          borderBottom: '1px solid rgba(255,255,255,.08)',
        }}
      >
        <BrandLockup variant="white" size={26} showTagline />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '14px 12px' }}>
        {nav.map(([k, label, Icon]) => {
          const on = primaryActive(k);
          return (
            <a
              key={k}
              onClick={() => go(k)}
              className="navitem"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 12px',
                borderRadius: 8,
                color: on ? 'var(--navy-ink)' : 'rgba(243,246,251,.66)',
                cursor: 'pointer',
                fontSize: '.9rem',
                fontWeight: on ? 600 : 500,
                background: on ? 'rgba(255,255,255,.1)' : 'transparent',
              }}
            >
              <Icon size={18} strokeWidth={on ? 2.2 : 1.9} />
              {label}
            </a>
          );
        })}
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          color: 'rgba(243,246,251,.4)',
          fontSize: '.7rem',
          fontFamily: 'var(--mono)',
          padding: '16px 20px',
          borderTop: '1px solid rgba(255,255,255,.06)',
        }}
      >
        v1.0 · MVP
      </div>
    </nav>
  );

  const RailNav = (
    <nav
      style={{
        gridArea: 'side',
        background: 'var(--navy)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        borderRight: '1px solid rgba(255,255,255,.06)',
      }}
    >
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          borderBottom: '1px solid rgba(255,255,255,.08)',
        }}
      >
        <BrandMark variant="white" size={28} />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          alignItems: 'center',
          padding: '12px 0',
        }}
      >
        {nav.map(([k, label, Icon]) => {
          const on = primaryActive(k);
          return (
            <a
              key={k}
              onClick={() => go(k)}
              title={label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                width: 52,
                padding: '9px 0',
                borderRadius: 9,
                color: on ? 'var(--navy-ink)' : 'rgba(243,246,251,.6)',
                cursor: 'pointer',
                background: on ? 'rgba(255,255,255,.1)' : 'transparent',
              }}
            >
              <Icon size={19} strokeWidth={on ? 2.2 : 1.9} />
              <span style={{ fontSize: '.5rem', fontWeight: 600, letterSpacing: '.02em' }}>
                {label.split(' ')[0].slice(0, 8)}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );

  const TopBar = (
    <div
      className="between"
      style={{
        gridArea: 'top',
        background: 'var(--navy)',
        color: 'var(--navy-ink)',
        padding: '0 24px',
        height: 64,
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}
    >
      {portal ? (
        portalTag
      ) : (
        <span style={{ fontFamily: 'var(--body)', fontWeight: 600, fontSize: '.8rem', color: 'rgba(243,246,251,.5)', letterSpacing: '.04em' }}>
          READINESS PORTAL
        </span>
      )}
      <TopActions compact={portal} />
    </div>
  );

  const TopNavBar = (
    <div
      style={{
        gridArea: 'top',
        background: 'var(--navy)',
        color: 'var(--navy-ink)',
      }}
    >
      <div className="between" style={{ padding: '0 24px', height: 60 }}>
        <span className="center" style={{ gap: 16 }}>
          <BrandLockup variant="white" size={26} />
          {portal && portalTag}
        </span>
        <TopActions compact />
      </div>
      <div
        className="center"
        style={{
          padding: '0 16px',
          gap: 2,
          height: 46,
          borderTop: '1px solid rgba(255,255,255,.08)',
          overflowX: 'auto',
        }}
      >
        {nav.map(([k, label, Icon]) => {
          const on = primaryActive(k);
          return (
            <a
              key={k}
              onClick={() => go(k)}
              className="center"
              style={{
                gap: 7,
                padding: '7px 13px',
                borderRadius: 8,
                color: on ? 'var(--navy-ink)' : 'rgba(243,246,251,.66)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontSize: '.86rem',
                fontWeight: on ? 600 : 500,
                background: on ? 'rgba(255,255,255,.1)' : 'transparent',
              }}
            >
              <Icon size={16} strokeWidth={on ? 2.2 : 1.9} />
              {label}
            </a>
          );
        })}
      </div>
    </div>
  );

  /* client context bar (breadcrumb + horizontal tabs). Internal only — portal
     users get the reduced top-level nav instead, never the intake/scope/tasks
     /audit tab strip. */
  const clientBar = !portal && inClient && (
    <div className="w-card" style={{ marginBottom: 'var(--gap)', padding: '14px 18px 0' }}>
      <div className="between" style={{ marginBottom: 12 }}>
        <div>
          <div className="center" style={{ gap: 6, fontSize: '.8rem' }}>
            <a className="muted" style={{ cursor: 'pointer' }} onClick={() => go('clients')}>
              Clients
            </a>
            <ChevronRight size={13} strokeWidth={2} className="faint" />
            <span className="w-h2" style={{ fontSize: '1.1rem' }}>
              {currentClient?.name ?? 'Client'}
            </span>
          </div>
          <div
            className="center mono"
            style={{ gap: 16, fontSize: '.72rem', color: 'var(--ink-faint)', marginTop: 5 }}
          >
            <span>{(currentClient?.cmmcPath ?? 'Undetermined').toUpperCase()}</span>
            {currentClient?.deadline && <span>DEADLINE {currentClient.deadline.toUpperCase()}</span>}
            <span>OWNER: {(currentClient?.owner ?? 'Unassigned').toUpperCase()}</span>
          </div>
        </div>
        {currentClient?.riskRating && <RiskBadge level={currentClient.riskRating} />}
      </div>
      <div className="w-tabs">
        {CLIENT_TAB.map(([k, label]) => {
          const target = CLIENT_TAB_SCREEN[k] || (k as ScreenKey);
          const on =
            target === screen || (k === 'client-dashboard' && screen === 'client-dashboard');
          return (
            <span key={k} className={'w-tab' + (on ? ' on' : '')} onClick={() => go(target)}>
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );

  if (navStyle === 'topnav') {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateAreas: '"top" "main"',
          gridTemplateRows: 'auto 1fr',
          minHeight: '100vh',
        }}
      >
        {TopNavBar}
        <main style={{ gridArea: 'main', padding: 'var(--pad)' }}>
          {clientBar}
          {children}
        </main>
      </div>
    );
  }

  const sideWidth = navStyle === 'hybrid' ? '72px' : '232px';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateAreas: '"side top" "side main"',
        gridTemplateColumns: `${sideWidth} 1fr`,
        gridTemplateRows: 'auto 1fr',
        minHeight: '100vh',
      }}
    >
      {navStyle === 'hybrid' ? RailNav : SideNav}
      {TopBar}
      <main style={{ gridArea: 'main', padding: 'var(--pad)' }}>
        {clientBar}
        {children}
      </main>
    </div>
  );
}
