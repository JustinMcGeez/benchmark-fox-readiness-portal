/* ============================================================
   Seed data — scoping workspace summary + asset inventory.
   Prototype data for the active engagement; moved out of the screens.
   ============================================================ */

export interface ScopeSummary {
  assessmentBoundary: string;
  cuiStrategy: string;
  mspInvolved: string;
  cloudServices: string;
  notes: string;
}

export const SCOPE_SUMMARY: ScopeSummary = {
  assessmentBoundary: 'CUI Enclave',
  cuiStrategy: 'CUI Enclave',
  mspInvolved: 'Yes',
  cloudServices: 'M365 GCC High + Azure',
  notes:
    'Enclave approach scopes CUI to a dedicated GCC High tenant. Engineering CAD workstations to be isolated. MSP manages endpoints — confirm SPA classification.',
};

export type ScopeAssetCategory =
  | 'CUI Asset'
  | 'Security Protection'
  | 'Contractor Risk Managed'
  | 'Specialized'
  | 'Out-of-Scope';

export interface ScopeAsset {
  id: string;
  name: string;
  type: string;
  category: ScopeAssetCategory;
  handlesCui: boolean;
  owner: string;
  inScope: boolean;
}

export const SCOPE_ASSETS: ScopeAsset[] = [
  { id: 'as-1', name: 'GCC High Tenant', type: 'Cloud', category: 'CUI Asset', handlesCui: true, owner: 'MSP', inScope: true },
  { id: 'as-2', name: 'CAD Workstations', type: 'Endpoint', category: 'CUI Asset', handlesCui: true, owner: 'IT Lead', inScope: true },
  { id: 'as-3', name: 'Firewall (HQ)', type: 'Network', category: 'Security Protection', handlesCui: false, owner: 'MSP', inScope: true },
  { id: 'as-4', name: 'Marketing Laptops', type: 'Endpoint', category: 'Out-of-Scope', handlesCui: false, owner: 'IT Lead', inScope: false },
];

export const ASSET_CATEGORIES: ScopeAssetCategory[] = [
  'CUI Asset',
  'Security Protection',
  'Contractor Risk Managed',
  'Specialized',
  'Out-of-Scope',
];
