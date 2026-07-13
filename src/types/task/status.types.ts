export interface StatusDefinition {
  key: string;
  label: string;
  color: string;
}

export const TASK_STATUSES: StatusDefinition[] = [
  { key: 'todo', label: 'A fazer', color: '#9e9e9e' },
  { key: 'doing', label: 'Fazendo', color: '#1a73e8' },
  { key: 'done', label: 'Concluída', color: '#33b679' },
];
