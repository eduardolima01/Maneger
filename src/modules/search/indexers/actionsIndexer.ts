export interface ActionItem {
  id: string;
  title: string;
  path: string;
  icon: string;
}

export const ACTION_ITEMS: ActionItem[] = [
  { id: 'action-new-project', title: 'Novo Projeto', path: '/projects', icon: '➕' },
  { id: 'action-new-task', title: 'Nova Task', path: '/tasks', icon: '➕' },
  { id: 'action-new-note', title: 'Nova Nota', path: '/notes', icon: '➕' },
  { id: 'action-new-log', title: 'Novo Log', path: '/logs', icon: '➕' },
  { id: 'action-new-kanban', title: 'Novo Kanban', path: '/kanban', icon: '➕' },
  { id: 'action-open-chat', title: 'Novo Chat', path: '/chat', icon: '➕' },
  { id: 'action-open-settings', title: 'Abrir Configurações', path: '/settings', icon: '⚙️' },
];
