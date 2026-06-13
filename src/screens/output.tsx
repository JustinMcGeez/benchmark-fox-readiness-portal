/* ============================================================
   Screens — output: Reports, Report Preview, Knowledge, Audit,
   Settings, Mobile
   ============================================================ */
import { useState } from 'react';
import { FileText, Menu } from 'lucide-react';
import type { ScreenProps, Tone } from '../types';
import {
  Badge,
  Btn,
  Card,
  PageHead,
  Ph,
  Tabs,
  Toolbar,
  WarnBanner,
} from '../components/primitives';
import { BrandLockup } from '../components/Brand';
import { BackendStatusCard } from '../components/BackendStatusCard';
import { EXPORT_FORMATS, REPORTS } from '../data/reports';
import { USERS } from '../data/clients';
import { useClients, useCurrentClient } from '../data/clientsStore';
import {
  useAuditLog,
  AUDIT_FILTER_ALL,
  type AuditFilterOption,
} from '../data/useAuditLog';
import { auditDiffLines, humanizeAuditAction, type AuditLogEntry } from '../lib/auditLog';
import { KNOWLEDGE } from '../data/knowledge';
import { POAM_ITEMS } from '../data/poam';
import { TASKS } from '../data/tasks';
import { useData } from '../data/store';
import { EXPECTED_CONTROL_COUNT } from '../data/controls';
import { useReference } from '../data/referenceStore';
import {
  estimateSprs,
  formatScore,
  readinessPct,
  scoringFinalized,
  topDeductionDrivers,
} from '../lib/scoring';
import {
  blockerItems,
  evidenceObjectiveSummary,
  missingEvidenceCount,
  openTaskCount,
  topFindings,
} from '../lib/selectors';
import { SourceRefs } from '../components/SourceRefs';
import { ScoringWarning } from '../components/ScoringWarning';

/* ---------- 16. REPORTS ---------- */
export function ReportsScreen({ go }: ScreenProps) {
  const currentClient = useCurrentClient();
  return (
    <div className="col">
      <PageHead
        title={`Reports — ${currentClient?.name ?? 'Client'}`}
        sub="Generate client-ready Benchmark Fox readiness deliverables."
      />
      <div className="grid-2">
        {REPORTS.map((r) => (
          <div key={r.id} className="w-card between" style={{ alignItems: 'center' }}>
            <div className="center" style={{ gap: 14 }}>
              <span
                className="center"
                style={{
                  width: 44,
                  height: 44,
                  flex: 'none',
                  justifyContent: 'center',
                  borderRadius: 10,
                  background: 'var(--fill)',
                  color: 'var(--navy)',
                }}
              >
                <FileText size={20} strokeWidth={2} />
              </span>
              <div>
                <div className="w-h2" style={{ fontSize: '1.1em' }}>
                  {r.title}
                </div>
                <p className="muted" style={{ margin: '2px 0 4px', fontSize: '.88em' }}>
                  {r.description}
                </p>
                <div className="row wrap gap-sm">
                  {r.feeds.map((f) => (
                    <span key={f} className="mono faint" style={{ fontSize: '.7rem' }}>
                      · {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <Btn primary onClick={() => go('report-preview')}>
              Generate
            </Btn>
          </div>
        ))}
      </div>
      <Card title="Export Options">
        <div className="row gap-sm wrap">
          {EXPORT_FORMATS.map((e) => (
            <Badge key={e} fill>
              {e}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------- 17. REPORT PREVIEW ---------- */
export function ReportPreviewScreen({ go }: ScreenProps) {
  const { assessments, evidence } = useData();
  const { controlsById, controls } = useReference();
  const currentClient = useCurrentClient();
  const readiness = readinessPct(assessments);
  const sprs = estimateSprs(assessments, controlsById);
  const drivers = topDeductionDrivers(assessments, controlsById, 5);
  const objCoverage = evidenceObjectiveSummary(controls, evidence, 5);
  const risk = readiness >= 80 ? 'Low' : readiness >= 60 ? 'Medium' : 'High';
  const findings = topFindings(assessments, POAM_ITEMS, evidence, controlsById, 5);
  return (
    <div className="col">
      <PageHead
        title="Report Preview: Executive Readiness Summary"
        sub={`Client: ${currentClient?.name ?? 'Client'} · Prepared by Benchmark Fox`}
        actions={
          <>
            <Btn onClick={() => go('reports')}>Edit Sections</Btn>
            <Btn>Export DOCX</Btn>
            <Btn primary>Export PDF</Btn>
          </>
        }
      />
      <ScoringWarning />
      <Tabs items={['Preview', 'Edit Sections', 'Export']} active="Preview" />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="w-card" style={{ width: 680, padding: 40, background: 'var(--white)' }}>
          <div
            className="between"
            style={{ borderBottom: '2px solid var(--navy)', paddingBottom: 16, marginBottom: 22 }}
          >
            <BrandLockup variant="navy" size={26} />
            <span className="mono faint" style={{ fontSize: '.78em' }}>
              JULY 2026
            </span>
          </div>
          <h2 className="w-h2" style={{ fontSize: '1.6em' }}>
            Executive CMMC Readiness Summary
          </h2>
          <p className="muted" style={{ marginTop: 4 }}>
            {currentClient?.name ?? 'Client'} · {currentClient?.cmmcPath ?? 'Undetermined'}
          </p>
          <div className="grid-3 mt">
            <div className="w-box" style={{ padding: 12, textAlign: 'center' }}>
              <div className="mono faint" style={{ fontSize: '.7em' }}>
                READINESS
              </div>
              <div className="w-h1">{readiness}%</div>
            </div>
            <div className="w-box" style={{ padding: 12, textAlign: 'center' }}>
              <div className="mono faint" style={{ fontSize: '.7em' }}>
                EST. SPRS
              </div>
              <div className="w-h1">{formatScore(sprs.estimatedSprsScore)}</div>
              <div className="mono faint" style={{ fontSize: '.62em' }}>−{sprs.totalDeductions} ded.</div>
            </div>
            <div className="w-box" style={{ padding: 12, textAlign: 'center' }}>
              <div className="mono faint" style={{ fontSize: '.7em' }}>
                RISK
              </div>
              <div className="w-h1" style={{ fontSize: '1.5em', marginTop: 8 }}>
                {risk}
              </div>
            </div>
          </div>
          <h3 className="w-h2" style={{ marginTop: 24, fontSize: '1.15em' }}>
            Estimated SPRS Score
          </h3>
          <p className="muted" style={{ margin: '2px 0 0', fontSize: '.92em' }}>
            {formatScore(sprs.estimatedSprsScore)} of 110 · −{sprs.totalDeductions} total deductions
            across {sprs.deductionCount} unmet control(s), incl. {sprs.highImpactGapCount} high-impact
            (−5) gap(s). Based on the DoD Assessment Methodology; Partial counted conservatively as Not
            Met.
          </p>
          <h3 className="w-h2" style={{ marginTop: 18, fontSize: '1.15em' }}>
            Top SPRS Deduction Drivers
          </h3>
          <ol className="muted" style={{ paddingLeft: 18 }}>
            {drivers.length ? (
              drivers.map((d) => (
                <li key={d.control.id}>
                  <span className="mono">{d.control.id}</span> {d.control.title} —{' '}
                  <strong>−{d.impact}</strong> ({d.status})
                </li>
              ))
            ) : (
              <li>No deductions — all scored controls are Met or Not Applicable.</li>
            )}
          </ol>
          <h3 className="w-h2" style={{ marginTop: 18, fontSize: '1.15em' }}>
            Assessment Objective Coverage (NIST SP 800-171A)
          </h3>
          <p className="muted" style={{ margin: '2px 0 0', fontSize: '.92em' }}>
            {objCoverage.controlsFullyCovered} of {objCoverage.controlsWithObjectives} controls have
            full objective coverage; {objCoverage.controlsPartiallyCovered} partial,{' '}
            {objCoverage.controlsNotCovered} missing coverage.{' '}
            {objCoverage.coveredObjectives}/{objCoverage.totalObjectives} objectives covered by evidence
            metadata. Method scope — Examine {objCoverage.methodCounts.examine}, Interview{' '}
            {objCoverage.methodCounts.interview}, Test {objCoverage.methodCounts.test}.
          </p>
          {objCoverage.topNeedingEvidence.length > 0 && (
            <>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: '.9em', fontWeight: 700 }}>
                Top controls needing objective evidence:
              </p>
              <ol className="muted" style={{ paddingLeft: 18, margin: '2px 0 0' }}>
                {objCoverage.topNeedingEvidence.map((t) => (
                  <li key={t.controlId}>
                    <span className="mono">{t.controlId}</span> — {t.uncovered}/{t.total} objectives
                    uncovered
                  </li>
                ))}
              </ol>
            </>
          )}
          <h3 className="w-h2" style={{ marginTop: 18, fontSize: '1.15em' }}>
            Top Findings
          </h3>
          <ol className="muted" style={{ paddingLeft: 18 }}>
            {findings.length ? (
              findings.map((f) => <li key={f.id}>{f.text}</li>)
            ) : (
              <li>No material findings — readiness review in good standing.</li>
            )}
          </ol>
          <Ph h={120} style={{ marginTop: 16 }}>
            [ readiness-by-family chart ]
          </Ph>
          <p className="annot" style={{ marginTop: 16, fontSize: '.78em' }}>
            This report is for readiness support only and does not represent an official CMMC
            assessment, C3PAO result, legal opinion, certification guarantee, or contract award
            guarantee.
          </p>
        </div>
      </div>
      <SourceRefs ids={['nist-sp-800-171r2', 'dod-assessment-methodology', 'cfr-32-170', 'bf-internal']} />
    </div>
  );
}

/* ---------- 18. KNOWLEDGE BASE ---------- */
export function KnowledgeScreen(_: ScreenProps) {
  return (
    <div className="col">
      <PageHead
        title="Knowledge Base"
        sub="Benchmark Fox guidance, examples, templates, and implementation notes."
        actions={<Btn primary>+ New Article</Btn>}
      />
      <Toolbar search="Search knowledge…" filters={['Control', 'Family', 'Tool', 'Artifact Type']} />
      <Card style={{ padding: '6px 6px' }}>
        <table className="w-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Related Control</th>
              <th>Type</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {KNOWLEDGE.map((k) => (
              <tr key={k.id}>
                <td style={{ fontWeight: 700 }}>{k.title}</td>
                <td className="mono">{k.relatedControl}</td>
                <td>
                  <Badge fill>{k.type}</Badge>
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
    </div>
  );
}

/* ---------- 19. AUDIT LOG ---------- */
function AuditFilter({
  allLabel,
  value,
  options,
  onChange,
}: {
  allLabel: string;
  value: string;
  options: AuditFilterOption[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="w-input"
      aria-label={allLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: 'auto', padding: '7px 10px', fontSize: '.85rem', cursor: 'pointer', color: 'var(--ink-soft)' }}
    >
      <option value={AUDIT_FILTER_ALL}>{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Humanized diff (or the seed's freeform detail) for the Details column. */
function AuditDetails({ entry }: { entry: AuditLogEntry }) {
  if (entry.diff) {
    return (
      <div className="col" style={{ gap: 2 }}>
        {auditDiffLines(entry.diff).map((l) => (
          <span key={l.field} className="mono" style={{ fontSize: '.85em' }}>
            {l.label}: {l.created ? l.new : `${l.old} → ${l.new}`}
          </span>
        ))}
      </div>
    );
  }
  return (
    <span className="mono" style={{ fontSize: '.85em' }}>
      {entry.details ?? '—'}
    </span>
  );
}

export function AuditScreen(_: ScreenProps) {
  const {
    mode,
    entries,
    isLoading,
    isError,
    retry,
    hasMore,
    loadMore,
    isFetchingMore,
    filters,
    setFilter,
    clientOptions,
    actorOptions,
    actionOptions,
  } = useAuditLog();

  return (
    <div className="col">
      <PageHead
        title="Audit Log"
        sub="Review platform activity and important changes."
        actions={mode === 'local' ? <Badge tone="warn">Demo data</Badge> : undefined}
      />

      <div className="w-card row wrap" style={{ alignItems: 'center', padding: '10px 12px', gap: 10 }}>
        <span className="muted" style={{ fontSize: '.85em' }}>
          Filter
        </span>
        <div className="grow" />
        <AuditFilter allLabel="All clients" value={filters.client} options={clientOptions} onChange={(v) => setFilter('client', v)} />
        <AuditFilter allLabel="All actors" value={filters.actor} options={actorOptions} onChange={(v) => setFilter('actor', v)} />
        <AuditFilter allLabel="All actions" value={filters.action} options={actionOptions} onChange={(v) => setFilter('action', v)} />
      </div>

      <Card style={{ padding: '6px 6px' }}>
        {isError ? (
          <div className="col" style={{ gap: 12, padding: 16 }}>
            <WarnBanner tone="bad">We couldn’t load the audit log. Please try again.</WarnBanner>
            <div>
              <Btn primary onClick={retry}>
                Retry
              </Btn>
            </div>
          </div>
        ) : isLoading ? (
          <div className="col" style={{ gap: 10, padding: 16 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="w-skeleton" style={{ height: 18, width: `${90 - i * 8}%` }} />
            ))}
          </div>
        ) : (
          <table className="w-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Client</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: 16, textAlign: 'center' }}>
                    No activity matches these filters.
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id}>
                    <td className="mono faint" style={{ fontSize: '.85em' }}>
                      {e.timestamp}
                    </td>
                    <td>{e.actorName}</td>
                    <td className="muted">{e.clientName ?? '—'}</td>
                    <td>{humanizeAuditAction(e.action)}</td>
                    <td>
                      <AuditDetails entry={e} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </Card>

      {hasMore && (
        <div className="center" style={{ justifyContent: 'center', padding: 8 }}>
          <Btn onClick={loadMore} disabled={isFetchingMore}>
            {isFetchingMore ? 'Loading…' : 'Load more'}
          </Btn>
        </div>
      )}
    </div>
  );
}

/* ---------- 20. SETTINGS ---------- */
/** Small Yes/No status row for the MVP status card. */
function StatusRow({ label, value }: { label: string; value: boolean | string }) {
  const isText = typeof value === 'string';
  return (
    <div className="between" style={{ padding: '7px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <span className="muted" style={{ fontSize: '.9em' }}>{label}</span>
      {isText ? (
        <Badge tone="none">{value}</Badge>
      ) : (
        <Badge tone={value ? 'ok' : 'bad'}>{value ? 'Yes' : 'No'}</Badge>
      )}
    </div>
  );
}

export function SettingsScreen(_: ScreenProps) {
  const [tab, setTab] = useState('Users');
  const { controls, controlsById } = useReference();
  const libraryComplete = controls.length >= EXPECTED_CONTROL_COUNT;
  return (
    <div className="col">
      {/* Backend Status — first element after the return, before any tab/panel,
          so it is visible regardless of the selected Settings tab below. */}
      <BackendStatusCard />
      <PageHead title="Settings" sub="Manage platform configuration." />
      <Card title="Current MVP status">
        <div className="grid-2" style={{ gap: '0 var(--gap)' }}>
          <StatusRow label="Full 110 controls loaded" value={libraryComplete} />
          <StatusRow label="Official scoring values loaded" value={scoringFinalized(controlsById)} />
          <StatusRow label="Assessment objectives loaded" value={false} />
          <StatusRow label="Backend connected" value={false} />
          <StatusRow label="Client portal enabled" value={false} />
          <StatusRow label="Evidence file storage enabled" value={false} />
          <StatusRow label="Intake editable" value={true} />
          <StatusRow label="Scope editable" value={true} />
          <StatusRow label="Data persistence" value="localStorage only" />
        </div>
      </Card>
      <Tabs
        items={['Users', 'Roles', 'Branding', 'Report Templates', 'Control Library', 'Security']}
        active={tab}
        onPick={setTab}
      />
      {tab === 'Users' ? (
        <Card style={{ padding: '6px 6px' }}>
          <div className="between" style={{ padding: '6px 12px' }}>
            <span className="mono faint" style={{ fontSize: '.78em' }}>
              {USERS.length} USERS
            </span>
            <Btn sm primary>
              + Invite User
            </Btn>
          </div>
          <table className="w-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {USERS.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="mono" style={{ fontSize: '.85em' }}>
                    {u.email}
                  </td>
                  <td>{u.role}</td>
                  <td>
                    <Badge tone={u.status === 'Active' ? 'ok' : u.status === 'Invited' ? 'warn' : 'none'}>
                      {u.status}
                    </Badge>
                  </td>
                  <td>
                    <a className="annot" style={{ cursor: 'pointer' }}>
                      Edit
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card title={tab}>
          <Ph h={200}>[ {tab} settings panel ]</Ph>
        </Card>
      )}
      <div className="annot">
        Tabs: Users · Roles · Branding · Report Templates · Control Library · Evidence · Security ·
        Retention · Notifications
      </div>
    </div>
  );
}

/* ---------- 21. MOBILE DIRECTION ---------- */
export function MobileScreen(_: ScreenProps) {
  const { assessments, currentClientId, evidence } = useData();
  const { clients } = useClients();
  const { controlsById } = useReference();
  const clientName = clients.find((c) => c.id === currentClientId)?.name ?? 'Client';
  const readiness = readinessPct(assessments);
  const sprs = estimateSprs(assessments, controlsById);
  const blockers = blockerItems(POAM_ITEMS).length;
  const missingEvidence = missingEvidenceCount(evidence);
  const openTasks = openTaskCount(TASKS);
  const mobileSupports: [string, Tone][] = [
    ['Dashboard viewing', 'ok'],
    ['Task review', 'ok'],
    ['Evidence upload', 'ok'],
    ['Commenting', 'ok'],
    ['Status review', 'ok'],
    ['Report viewing', 'ok'],
    ['Full control assessment', 'none'],
  ];
  return (
    <div className="col" style={{ alignItems: 'center' }}>
      <PageHead
        title="Mobile Direction"
        sub="Desktop-first, but mobile-friendly for review & quick updates."
      />
      <div style={{ width: '100%', maxWidth: 620 }}>
        <ScoringWarning />
      </div>
      <div className="row wrap" style={{ justifyContent: 'center', gap: 30 }}>
        <div>
          <div className="annot" style={{ marginBottom: 8 }}>
            Client snapshot
          </div>
          <div className="w-card" style={{ width: 260, padding: 0, overflow: 'hidden' }}>
            <div
              className="between"
              style={{ background: 'var(--navy)', color: 'var(--navy-ink)', padding: '12px 14px' }}
            >
              <BrandLockup variant="white" size={18} />
              <Menu size={18} strokeWidth={2} />
            </div>
            <div style={{ padding: 14 }} className="col">
              <div className="w-box" style={{ padding: 10 }}>
                <div className="muted" style={{ fontSize: '.8em' }}>
                  Client
                </div>
                <strong>{clientName}</strong>
              </div>
              <div className="grid-2" style={{ gap: 8 }}>
                <div className="w-box" style={{ padding: 10, textAlign: 'center' }}>
                  <div className="mono faint" style={{ fontSize: '.6em' }}>
                    READY
                  </div>
                  <div className="w-h2">{readiness}%</div>
                </div>
                <div className="w-box" style={{ padding: 10, textAlign: 'center' }}>
                  <div className="mono faint" style={{ fontSize: '.6em' }}>
                    SCORE
                  </div>
                  <div className="w-h2">{formatScore(sprs.estimatedSprsScore)}</div>
                </div>
              </div>
              <div className="w-box between" style={{ padding: '8px 10px' }}>
                <span>Critical Blockers</span>
                <Badge tone="crit">{blockers}</Badge>
              </div>
              <div className="w-box between" style={{ padding: '8px 10px' }}>
                <span>Missing Evidence</span>
                <Badge tone="bad">{missingEvidence}</Badge>
              </div>
              <div className="w-box between" style={{ padding: '8px 10px' }}>
                <span>Open Tasks</span>
                <Badge tone="warn">{openTasks}</Badge>
              </div>
              <Btn primary style={{ width: '100%' }}>
                Continue Review
              </Btn>
              <Btn style={{ width: '100%' }}>Upload Evidence</Btn>
            </div>
          </div>
        </div>
        <Card title="Mobile supports (MVP)" style={{ width: 320, alignSelf: 'flex-start' }}>
          <div className="col" style={{ gap: 9 }}>
            {mobileSupports.map(([t, tone]) => (
              <div key={t} className="center" style={{ gap: 10 }}>
                <span className={'dot ' + tone} style={{ width: 9, height: 9, borderRadius: '50%' }} />
                {t}
                {tone === 'none' && (
                  <span className="faint" style={{ fontSize: '.8em' }}>
                    — desktop only in MVP
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
