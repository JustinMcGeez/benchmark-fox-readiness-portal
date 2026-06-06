/* Shared types for the Benchmark Fox Readiness Portal wireframes. */

/** All navigable screen keys. */
export type ScreenKey =
  | 'login'
  | 'dashboard'
  | 'clients'
  | 'create-client'
  | 'client-dashboard'
  | 'intake'
  | 'path'
  | 'scope'
  | 'control-library'
  | 'controls'
  | 'control-detail'
  | 'ssp'
  | 'poam'
  | 'evidence'
  | 'tasks'
  | 'reports'
  | 'report-preview'
  | 'knowledge'
  | 'audit'
  | 'settings'
  | 'mobile';

/** Navigate to a screen (resets scroll, persists last screen). */
export type Go = (screen: ScreenKey) => void;

/** Every screen component receives the navigation function. */
export interface ScreenProps {
  go: Go;
}

/** Status / risk tone keys that map to the small color dots. */
export type Tone = 'low' | 'med' | 'high' | 'crit' | 'ok' | 'warn' | 'bad' | 'none';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type NavStyle = 'sidebar' | 'topnav' | 'hybrid';
export type Density = 'breathable' | 'dense';

export type TweakValues = {
  navStyle: NavStyle;
  density: Density;
};
