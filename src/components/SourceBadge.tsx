/* ============================================================
   Source attribution UI — shows which official documents back the
   data on a screen. Used on Control Detail, SSP, POA&M, Evidence,
   and CMMC Path screens.
   ============================================================ */
import { BookMarked } from 'lucide-react';
import { getSources, type SourceRef } from '../data/sourceRefs';

export function SourceBadge({ source }: { source: SourceRef }) {
  const title = [source.sourceName, source.version, source.reference, source.notes]
    .filter(Boolean)
    .join(' · ');
  const body = (
    <>
      <BookMarked size={12} strokeWidth={2} />
      <span style={{ fontWeight: 600 }}>{source.sourceName.split(' — ')[0]}</span>
      {source.reference && <span className="faint">· {source.reference}</span>}
    </>
  );
  const style: React.CSSProperties = {
    gap: 6,
    fontSize: '.72rem',
    color: 'var(--ink-soft)',
    border: '1px solid var(--line)',
    background: 'var(--surface-2)',
    borderRadius: 999,
    padding: '4px 10px',
    textDecoration: 'none',
  };
  return source.url ? (
    <a className="center" style={style} href={source.url} target="_blank" rel="noreferrer" title={title}>
      {body}
    </a>
  ) : (
    <span className="center" style={style} title={title}>
      {body}
    </span>
  );
}

/** A small "Sources" block listing the documents that back a screen's data. */
export function Sources({ ids, title = 'Sources' }: { ids: string[]; title?: string }) {
  const sources = getSources(ids);
  if (!sources.length) return null;
  return (
    <div className="w-card" style={{ padding: '12px 16px' }}>
      <div className="center" style={{ gap: 8, marginBottom: 10 }}>
        <BookMarked size={15} strokeWidth={2} className="faint" />
        <span className="w-eyebrow">{title}</span>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        {sources.map((s) => (
          <SourceBadge key={s.sourceId} source={s} />
        ))}
      </div>
    </div>
  );
}
