/* Seed data — Benchmark Fox knowledge base articles. */
import type { KnowledgeItem } from './types';

export const KNOWLEDGE: KnowledgeItem[] = [
  { id: 'kb-1', title: 'MFA Evidence Examples', relatedControl: '3.5.3', type: 'Evidence' },
  { id: 'kb-2', title: 'SSP Language for Access Control', relatedControl: '3.1.1–3.1.22', type: 'SSP' },
  { id: 'kb-3', title: 'CUI Data Flow Example', relatedControl: 'Scoping', type: 'Diagram' },
  { id: 'kb-4', title: 'POA&M Closure Evidence Guide', relatedControl: '3.12.2', type: 'POA&M' },
  { id: 'kb-5', title: 'GCC High Migration Checklist', relatedControl: 'SC family', type: 'Template' },
  { id: 'kb-6', title: 'Audit Logging Config (Sentinel)', relatedControl: '3.3.1', type: 'Technical' },
];
