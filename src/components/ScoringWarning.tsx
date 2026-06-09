/* ============================================================
   ScoringWarning — banner shown only when official SPRS scoring is
   incomplete or missing for one or more controls. Renders nothing
   once the official DoD Assessment Methodology values are loaded
   (the current state).
   ============================================================ */
import { WarnBanner } from './primitives';
import { scoringFinalized } from '../lib/scoring';
import { useReference } from '../data/referenceStore';

export const SCORING_WARNING_TEXT =
  'Official SPRS scoring is incomplete or missing for one or more controls.';

export function ScoringWarning() {
  const { controlsById } = useReference();
  // Official scoring is fully loaded → no warning.
  if (scoringFinalized(controlsById)) return null;
  return <WarnBanner tone="warn">{SCORING_WARNING_TEXT}</WarnBanner>;
}
