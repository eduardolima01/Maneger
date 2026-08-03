export type ModuleKey = 'tasks' | 'kanban' | 'notes' | 'agenda' | 'logs' | 'pomodoro';

export const ALL_MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'kanban', label: 'Kanban' },
  { key: 'logs', label: 'Logs' },
  { key: 'notes', label: 'Notas' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'pomodoro', label: 'Pomodoro' },
];
