export type ModuleKey = 'tasks' | 'kanban' | 'notes' | 'agenda';

export const ALL_MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'kanban', label: 'Kanban' },
  { key: 'notes', label: 'Notas' },
  { key: 'agenda', label: 'Agenda' },
];
