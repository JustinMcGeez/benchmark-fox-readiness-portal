/* ============================================================
   Shared wireframe primitives — tiny building blocks, charts,
   and layout helpers used across every screen.
   ============================================================ */
import type { CSSProperties, ReactNode } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { RiskLevel, Tone } from '../types';

/* ---------- tiny primitives ---------- */
export function Btn({
  children,
  primary,
  ghost,
  sm,
  onClick,
  style,
}: {
  children: ReactNode;
  primary?: boolean;
  ghost?: boolean;
  sm?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const cls = ['w-btn', primary && 'primary', ghost && 'ghost', sm && 'sm']
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} style={style} onClick={onClick}>
      {children}
    </button>
  );
}

export function Field({
  label,
  value,
  placeholder,
  area,
  w,
  rows,
  style,
}: {
  label?: string;
  value?: string;
  placeholder?: string;
  area?: boolean;
  w?: number | string;
  rows?: number;
  style?: CSSProperties;
}) {
  return (
    <div className="w-field" style={{ width: w, ...style }}>
      {label && <span className="w-label">{label}</span>}
      {area ? (
        <textarea
          className={'w-input' + (value ? '' : ' placeholder')}
          defaultValue={value}
          placeholder={placeholder}
          rows={rows ?? 4}
        />
      ) : (
        <input
          className={'w-input' + (value ? '' : ' placeholder')}
          defaultValue={value}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export function Select({
  label,
  value,
  w,
}: {
  label?: string;
  value?: string;
  w?: number | string;
}) {
  return (
    <div className="w-field" style={{ width: w }}>
      {label && <span className="w-label">{label}</span>}
      <div className="w-input between" style={{ cursor: 'pointer' }}>
        <span className={value ? '' : 'faint'}>{value || 'Select…'}</span>
        <ChevronDown size={15} strokeWidth={2} className="faint" />
      </div>
    </div>
  );
}

export function Check({
  label,
  on,
  radio,
}: {
  label: string;
  on?: boolean;
  radio?: boolean;
}) {
  return (
    <span className={['w-check', on && 'on', radio && 'radio'].filter(Boolean).join(' ')}>
      <span className="bx" /> <span>{label}</span>
    </span>
  );
}

/* ---------- badges & status ---------- */
const RISK: Record<RiskLevel, Tone> = {
  Low: 'low',
  Medium: 'med',
  High: 'high',
  Critical: 'crit',
};

export function Badge({
  children,
  tone,
  fill,
}: {
  children: ReactNode;
  tone?: Tone;
  fill?: boolean;
}) {
  const cls = ['w-badge', tone && tone !== 'none' && 't-' + tone, fill && 'fill']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls}>
      {tone && <span className={'dot ' + tone} />}
      {children}
    </span>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge tone={RISK[level] || 'none'}>{level}</Badge>;
}

/* readiness / status → tone mapping */
export const TONE: Record<string, Tone> = {
  Met: 'ok',
  Complete: 'ok',
  Accepted: 'ok',
  Strong: 'ok',
  Validated: 'ok',
  Current: 'ok',
  Implemented: 'ok',
  Yes: 'ok',
  Partial: 'warn',
  'Partially Met': 'warn',
  'Needs Fix': 'warn',
  'Needs Update': 'warn',
  'In Review': 'warn',
  Acceptable: 'warn',
  Ongoing: 'warn',
  Weak: 'warn',
  'In Progress': 'warn',
  'Needs Revision': 'warn',
  'Not Met': 'bad',
  Missing: 'bad',
  Rejected: 'bad',
  Blocked: 'bad',
  Blocker: 'bad',
  'Assessment Blocker': 'bad',
  Critical: 'crit',
  Expired: 'bad',
  No: 'bad',
  'Not Implemented': 'bad',
  'Not Reviewed': 'none',
  'Not Review': 'none',
  'Not Started': 'none',
  'Not Applicable': 'none',
  None: 'none',
  TBD: 'none',
  'Not Request': 'none',
};

export function Status({ s }: { s: string }) {
  return <Badge tone={TONE[s] || 'none'}>{s}</Badge>;
}

/* ---------- charts (simple sketch shapes) ---------- */
export function Donut({
  met = 55,
  partial = 25,
  value = '62%',
  label = 'READY',
}: {
  met?: number;
  partial?: number;
  value?: string;
  label?: string;
}) {
  const a = met * 3.6;
  const b = (met + partial) * 3.6;
  const bg = `conic-gradient(var(--navy) 0 ${a}deg, var(--silver) ${a}deg ${b}deg, var(--fill-2) ${b}deg 360deg)`;
  return (
    <div className="donut" style={{ background: bg }}>
      <div className="hole">
        <span className="big">{value}</span>
        <span className="sm">{label}</span>
      </div>
    </div>
  );
}

export function Legend({ items }: { items: { bg: string; t: string }[] }) {
  return (
    <div className="legend">
      {items.map((it, i) => (
        <div className="li" key={i}>
          <span className="sw" style={{ background: it.bg }} />
          <span>{it.t}</span>
        </div>
      ))}
    </div>
  );
}

export function BarChart({ rows }: { rows: { l: string; p: number; v: string }[] }) {
  return (
    <div>
      {rows.map((r, i) => (
        <div className="bar-row" key={i}>
          <span className="bar-label">{r.l}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: r.p + '%' }} />
          </span>
          <span className="bar-val">{r.v}</span>
        </div>
      ))}
    </div>
  );
}

export function StatCard({
  k,
  v,
  d,
  tone,
}: {
  k: string;
  v: ReactNode;
  d?: string;
  tone?: Tone;
}) {
  return (
    <div className="w-card stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {d && (
        <div className="d">
          <Badge tone={tone}>{d}</Badge>
        </div>
      )}
    </div>
  );
}

export function Ph({
  children,
  h,
  style,
}: {
  children: ReactNode;
  h?: number | string;
  style?: CSSProperties;
}) {
  return (
    <div className="w-ph" style={{ height: h, minHeight: h, ...style }}>
      {children}
    </div>
  );
}

export function WarnBanner({ children, tone = 'warn' }: { children: ReactNode; tone?: Tone }) {
  return (
    <div
      className="w-box"
      style={{
        background: 'var(--fill)',
        padding: '10px 14px',
        borderStyle: 'dashed',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <span
        className={'dot ' + tone}
        style={{ width: 12, height: 12, borderRadius: '50%', flex: 'none' }}
      />
      <span style={{ fontSize: '.9em' }}>{children}</span>
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  style,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="w-card" style={style}>
      {(title || action) && (
        <div className="between" style={{ marginBottom: 14 }}>
          {title && <span className="w-h2">{title}</span>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="between" style={{ marginBottom: 'var(--gap)', alignItems: 'flex-end' }}>
      <div>
        <h1 className="w-h1">{title}</h1>
        {sub && <p className="w-sub">{sub}</p>}
      </div>
      {actions && (
        <div className="row gap-sm wrap" style={{ justifyContent: 'flex-end' }}>
          {actions}
        </div>
      )}
    </div>
  );
}

export function Tabs({
  items,
  active,
  onPick,
}: {
  items: string[];
  active: string;
  onPick?: (t: string) => void;
}) {
  return (
    <div className="w-tabs">
      {items.map((t) => (
        <span
          key={t}
          className={'w-tab' + (t === active ? ' on' : '')}
          onClick={() => onPick && onPick(t)}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export function Toolbar({ search, filters }: { search?: string; filters?: string[] }) {
  return (
    <div className="w-card row wrap" style={{ alignItems: 'center', padding: '10px 12px', gap: 10 }}>
      <div className="w-input placeholder grow center" style={{ maxWidth: 320, gap: 8 }}>
        <Search size={15} strokeWidth={2} /> {search || 'Search…'}
      </div>
      <div className="grow" />
      {(filters || []).map((f, i) => (
        <div
          key={i}
          className="w-input between"
          style={{ width: 'auto', cursor: 'pointer', padding: '7px 12px', color: 'var(--ink-soft)' }}
        >
          <span style={{ fontSize: '.85em' }}>{f}</span>
          <ChevronDown size={14} strokeWidth={2} className="faint" />
        </div>
      ))}
    </div>
  );
}
