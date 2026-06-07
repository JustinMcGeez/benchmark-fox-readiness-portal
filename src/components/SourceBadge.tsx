/* ============================================================
   SourceBadge — a single source-document badge.
   Composed into the reusable SourceRefs list (see SourceRefs.tsx).
   ============================================================ */
import { BookMarked } from 'lucide-react';
import type { SourceRef } from '../data/sourceRefs';

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
