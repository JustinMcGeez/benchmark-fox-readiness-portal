/* ============================================================
   NIST SP 800-171 Rev. 2 control families (14).
   Section numbers and names per NIST SP 800-171 Rev. 2.
   ============================================================ */

export interface ControlFamily {
  /** family index used in the requirement number, e.g. '1' in 3.1.x */
  index: string;
  code: string; // 'AC'
  name: string; // 'Access Control'
  section: string; // '3.1'
}

export const CONTROL_FAMILIES: ControlFamily[] = [
  { index: '1', code: 'AC', name: 'Access Control', section: '3.1' },
  { index: '2', code: 'AT', name: 'Awareness and Training', section: '3.2' },
  { index: '3', code: 'AU', name: 'Audit and Accountability', section: '3.3' },
  { index: '4', code: 'CM', name: 'Configuration Management', section: '3.4' },
  { index: '5', code: 'IA', name: 'Identification and Authentication', section: '3.5' },
  { index: '6', code: 'IR', name: 'Incident Response', section: '3.6' },
  { index: '7', code: 'MA', name: 'Maintenance', section: '3.7' },
  { index: '8', code: 'MP', name: 'Media Protection', section: '3.8' },
  { index: '9', code: 'PS', name: 'Personnel Security', section: '3.9' },
  { index: '10', code: 'PE', name: 'Physical Protection', section: '3.10' },
  { index: '11', code: 'RA', name: 'Risk Assessment', section: '3.11' },
  { index: '12', code: 'CA', name: 'Security Assessment', section: '3.12' },
  { index: '13', code: 'SC', name: 'System and Communications Protection', section: '3.13' },
  { index: '14', code: 'SI', name: 'System and Information Integrity', section: '3.14' },
];

export const FAMILY_BY_INDEX: Record<string, ControlFamily> = Object.fromEntries(
  CONTROL_FAMILIES.map((f) => [f.index, f]),
);

/** Resolve the family from a requirement number like '3.10.1'. */
export function familyForNumber(number: string): ControlFamily | undefined {
  return FAMILY_BY_INDEX[number.split('.')[1]];
}
