/* Seed data — remediation tasks for the active client. */
import type { TaskItem } from './types';
import { CURRENT_CLIENT_ID } from './clients';

export const TASKS: TaskItem[] = [
  {
    id: 'tk-1',
    clientId: CURRENT_CLIENT_ID,
    title: 'Upload MFA evidence',
    owner: 'IT Lead',
    priority: 'High',
    dueDate: '07/15/2026',
    status: 'In Progress',
    relatedControlId: '3.5.3',
  },
  {
    id: 'tk-2',
    clientId: CURRENT_CLIENT_ID,
    title: 'Update SSP for AC controls',
    owner: 'CIO',
    priority: 'High',
    dueDate: '07/20/2026',
    status: 'Not Started',
    relatedControlId: '3.1.2',
  },
  {
    id: 'tk-3',
    clientId: CURRENT_CLIENT_ID,
    title: 'Provide CUI data flow diagram',
    owner: 'MSP',
    priority: 'Critical',
    dueDate: '07/12/2026',
    status: 'Blocked',
    description:
      'Document how CUI moves between CAD workstations, file share, and GCC High tenant.',
    relatedControlId: '3.1.3',
    relatedPoamId: 'PM-014',
  },
  {
    id: 'tk-4',
    clientId: CURRENT_CLIENT_ID,
    title: 'Configure audit log retention',
    owner: 'MSP',
    priority: 'High',
    dueDate: '07/22/2026',
    status: 'Not Started',
    relatedControlId: '3.3.1',
  },
  {
    id: 'tk-5',
    clientId: CURRENT_CLIENT_ID,
    title: 'Quarterly access review export',
    owner: 'HR / IT',
    priority: 'Medium',
    dueDate: '07/28/2026',
    status: 'In Progress',
    relatedControlId: '3.1.5',
  },
];

export const tasksForControl = (controlId: string): TaskItem[] =>
  TASKS.filter((t) => t.relatedControlId === controlId);
