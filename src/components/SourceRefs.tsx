/* ============================================================
   SourceRefs — reusable "Sources" block.

   Accepts an array of sourceIds and renders small source badges from the
   src/data/sourceRefs.ts registry. Used on Control Detail, CMMC Path, SSP
   Workspace, POA&M Tracker, Evidence Hub, and the Report Preview footer.
   ============================================================ */
import { BookMarked } from 'lucide-react';
import { getSources } from '../data/sourceRefs';
import { SourceBadge } from './SourceBadge';

export function SourceRefs({ ids, title = 'Sources' }: { ids: string[]; title?: string }) {
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
