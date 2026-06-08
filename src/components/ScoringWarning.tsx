/* ============================================================
   ScoringWarning — standardized banner shown wherever a score is
   displayed while SPRS deduction values are still placeholders.
   Renders nothing once official scoring is loaded.
   ============================================================ */
import { WarnBanner } from './primitives';
import { scoringFinalized } from '../lib/scoring';
import { useReference } from '../data/referenceStore';

export const SCORING_WARNING_TEXT =
  'Scoring values are placeholders until official DoD Assessment Methodology deductions are loaded. Readiness percentage is usable; SPRS-style score is not final.';

export function ScoringWarning() {
  const { controlsById } = useReference();
  if (scoringFinalized(controlsById)) return null;
  return <WarnBanner tone="warn">{SCORING_WARNING_TEXT}</WarnBanner>;
}
