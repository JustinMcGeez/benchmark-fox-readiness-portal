/* ============================================================
   App — router host, screen-index launcher, live tweaks
   (routes + ScreenKey↔path mapping live in src/routes.tsx)
   ============================================================ */
import { useEffect, useState } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import type { Density, NavStyle, ScreenKey, TweakValues } from './types';
import { AuthProvider } from './auth/AuthProvider';
import { DataProvider } from './data/store';
import { Btn } from './components/primitives';
import { TweaksPanel, TweakSection, TweakRadio, useTweaks } from './tweaks/TweaksPanel';
import { AppRoutes, screenKeyFromPath, useGo } from './routes';

/* index, grouped — for the launcher overlay */
const INDEX: [string, [ScreenKey, string][]][] = [
  ['Entry', [['login', '01 · Login']]],
  [
    'Benchmark Fox (internal)',
    [
      ['dashboard', '02 · Internal Dashboard'],
      ['clients', '03 · Clients List'],
      ['create-client', '04 · Create Client'],
    ],
  ],
  [
    'Client engagement',
    [
      ['client-dashboard', '05 · Client Dashboard'],
      ['intake', '06 · Guided Intake'],
      ['path', '07 · CMMC Path'],
      ['scope', '08 · Scoping Workspace'],
    ],
  ],
  [
    'Controls',
    [
      ['control-library', '09 · Control Library'],
      ['controls', '10 · Control Matrix ★'],
      ['control-detail', '11 · Control Detail'],
    ],
  ],
  [
    'Readiness work',
    [
      ['ssp', '12 · SSP Workspace'],
      ['poam', '13 · POA&M Tracker'],
      ['evidence', '14 · Evidence Hub'],
      ['tasks', '15 · Task Management'],
    ],
  ],
  [
    'Output & admin',
    [
      ['reports', '16 · Reports'],
      ['report-preview', '17 · Report Preview'],
      ['knowledge', '18 · Knowledge Base'],
      ['audit', '19 · Audit Log'],
      ['settings', '20 · Settings'],
      ['mobile', '21 · Mobile Direction'],
    ],
  ],
];
const FLAT: [ScreenKey, string][] = INDEX.flatMap((g) => g[1]);

const TWEAK_DEFAULTS: TweakValues = {
  navStyle: 'sidebar',
  density: 'breathable',
};

const NAV_OPTIONS: NavStyle[] = ['sidebar', 'topnav', 'hybrid'];
const DENSITY_OPTIONS: Density[] = ['breathable', 'dense'];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <AppChrome />
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppChrome() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [menu, setMenu] = useState(false);
  const go = useGo();
  const { pathname } = useLocation();
  const screen = screenKeyFromPath(pathname);

  /* persist the last visited screen (the `/` route restores it) */
  useEffect(() => {
    if (screen) localStorage.setItem('bf_screen', screen);
  }, [screen]);

  /* developer helper — wipe persisted edits and reload to seed data */
  const resetData = () => {
    ['bf_assessments_v1', 'bf_selected_control', 'bf_screen', 'bf_tweaks'].forEach((k) =>
      localStorage.removeItem(k),
    );
    window.location.reload();
  };

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-density',
      t.density === 'dense' ? 'dense' : 'breathable',
    );
  }, [t.density]);

  /* keyboard: [ and ] to step screens, g to toggle the index */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
      const i = FLAT.findIndex((f) => f[0] === screen);
      if (e.key === ']') go(FLAT[Math.min(FLAT.length - 1, i + 1)][0]);
      if (e.key === '[') go(FLAT[Math.max(0, i - 1)][0]);
      if (e.key === 'g') setMenu((m) => !m);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [screen, go]);

  const idx = FLAT.findIndex((f) => f[0] === screen) + 1;

  return (
    <>
      <AppRoutes navStyle={t.navStyle} />

      {/* screen-index launcher */}
      <button
        onClick={() => setMenu(true)}
        className="w-btn"
        id="screen-launcher"
        style={{
          position: 'fixed',
          left: 16,
          bottom: 16,
          zIndex: 1000,
          boxShadow: 'var(--sh-md)',
          background: 'var(--white)',
        }}
      >
        <LayoutGrid size={15} strokeWidth={2} /> Screens{' '}
        <span className="mono faint" style={{ fontSize: '.82em' }}>
          {String(idx).padStart(2, '0')}/{FLAT.length}
        </span>
      </button>

      {menu && (
        <div
          onClick={() => setMenu(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1001,
            background: 'rgba(30,28,24,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-card"
            style={{ width: 'min(880px, 96vw)', maxHeight: '88vh', overflow: 'auto', padding: 26 }}
          >
            <div className="between" style={{ marginBottom: 16 }}>
              <div>
                <h2 className="w-h2">Screen Index</h2>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: '.85em' }}>
                  Jump to any wireframe · or press <span className="mono">[</span>{' '}
                  <span className="mono">]</span> to step, <span className="mono">g</span> for this menu
                </p>
              </div>
              <Btn onClick={() => setMenu(false)}>✕ Close</Btn>
            </div>
            <div className="grid-3" style={{ alignItems: 'start' }}>
              {INDEX.map(([group, items]) => (
                <div key={group} className="col" style={{ gap: 7 }}>
                  <span className="w-eyebrow">{group}</span>
                  {items.map(([k, label]) => (
                    <a
                      key={k}
                      onClick={() => {
                        go(k);
                        setMenu(false);
                      }}
                      className="w-box"
                      style={{
                        padding: '8px 11px',
                        cursor: 'pointer',
                        fontSize: '.9em',
                        background: k === screen ? 'var(--fill)' : 'var(--white)',
                      }}
                    >
                      {label}
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Navigation structure" />
        <TweakRadio
          label="Nav style"
          value={t.navStyle}
          options={NAV_OPTIONS}
          onChange={(v) => setTweak('navStyle', v)}
        />
        <p style={{ margin: '2px 4px 0', fontSize: 11, opacity: 0.6, fontFamily: 'var(--mono)' }}>
          sidebar = full left rail · topnav = horizontal · hybrid = icon rail
        </p>
        <TweakSection label="Density" />
        <TweakRadio
          label="Spacing"
          value={t.density}
          options={DENSITY_OPTIONS}
          onChange={(v) => setTweak('density', v)}
        />
        <TweakSection label="Developer" />
        <button
          onClick={resetData}
          title="Clear bf_* localStorage keys and reload to seed data"
          style={{
            appearance: 'none',
            height: 28,
            border: '0',
            borderRadius: 7,
            background: 'rgba(0,0,0,.06)',
            color: 'inherit',
            font: 'inherit',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ↺ Reset demo data
        </button>
      </TweaksPanel>
    </>
  );
}
