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
} from '../components/primitives';
import { BrandLockup } from '../components/Brand';
import { EXPORT_FORMATS, REPORTS } from '../data/reports';
import { AUDIT_EVENTS, CURRENT_CLIENT, USERS } from '../data/clients';
import { KNOWLEDGE } from '../data/knowledge';
import { POAM_ITEMS } from '../data/poam';
import { EVIDENCE_ITEMS } from '../data/evidence';
import { TASKS } from '../data/tasks';
import { useData } from '../data/store';
import { CONTROLS_BY_ID, LIBRARY_COMPLETE } from '../data/controls';
import { formatScore, readinessPct, scoringFinalized, sprsScore } from '../lib/scoring';
import { blockerItems, missingEvidenceCount, openTaskCount, topFindings } from '../lib/selectors';
import { SourceRefs } from '../components/SourceRefs';
import { ScoringWarning } from '../components/ScoringWarning';

/* ---------- 16. REPORTS ---------- */
export function ReportsScreen({ go }: ScreenProps) {
  return (
    <div className="col">
      <PageHead
        title={`Reports — ${CURRENT_CLIENT.name}`}
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
  const { assessments } = useData();
  const readiness = readinessPct(assessments);
  const score = sprsScore(assessments, CONTROLS_BY_ID);
  const risk = readiness >= 80 ? 'Low' : readiness >= 60 ? 'Medium' : 'High';
  const findings = topFindings(assessments, POAM_ITEMS, EVIDENCE_ITEMS, CONTROLS_BY_ID, 5);
  return (
    <div className="col">
      <PageHead
        title="Report Preview: Executive Readiness Summary"
        sub={`Client: ${CURRENT_CLIENT.name} · Prepared by Benchmark Fox`}
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
            {CURRENT_CLIENT.name} · {CURRENT_CLIENT.cmmcPath}
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
                SCORE
              </div>
              <div className="w-h1">{formatScore(score)}</div>
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
        </div>
      </div>
      <SourceRefs title="Sources" ids={['nist-sp-800-171r2', 'dod-assessment-methodology', 'cfr-32-170', 'bf-internal']} />
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
export function AuditScreen(_: ScreenProps) {
  return (
    <div className="col">
      <PageHead title="Audit Log" sub="Review platform activity and important changes." />
      <Toolbar search="Search activity…" filters={['User', 'Client', 'Action', 'Date Range']} />
      <Card style={{ padding: '6px 6px' }}>
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
            {AUDIT_EVENTS.map((a) => (
              <tr key={a.id}>
                <td className="mono faint" style={{ fontSize: '.85em' }}>
                  {a.timestamp}
                </td>
                <td>{a.user}</td>
                <td className="muted">{a.client}</td>
                <td>{a.action}</td>
                <td className="mono" style={{ fontSize: '.85em' }}>
                  {a.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
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
  return (
    <div className="col">
      <PageHead title="Settings" sub="Manage platform configuration." />
      <Card title="Current MVP status">
        <div className="grid-2" style={{ gap: '0 var(--gap)' }}>
          <StatusRow label="Full 110 controls loaded" value={LIBRARY_COMPLETE} />
          <StatusRow label="Official scoring values loaded" value={scoringFinalized(CONTROLS_BY_ID)} />
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
  const { assessments } = useData();
  const readiness = readinessPct(assessments);
  const score = sprsScore(assessments, CONTROLS_BY_ID);
  const blockers = blockerItems(POAM_ITEMS).length;
  const missingEvidence = missingEvidenceCount(EVIDENCE_ITEMS);
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
                <strong>{CURRENT_CLIENT.name}</strong>
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
                  <div className="w-h2">{formatScore(score)}</div>
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
