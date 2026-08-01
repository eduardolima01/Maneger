export interface NavItem {
  id: string;
  title: string;
  path: string;
  icon: string;
}

export const NAVIGATION_ITEMS: NavItem[] = [
  { id: 'nav-dashboard', title: 'Dashboard', path: '/', icon: '🏠' },
  { id: 'nav-projects', title: 'Projetos', path: '/projects', icon: '📁' },
  { id: 'nav-kanban', title: 'Kanban', path: '/kanban', icon: '📋' },
  { id: 'nav-agenda', title: 'Agenda', path: '/agenda', icon: '📅' },
  { id: 'nav-tasks', title: 'Tarefas', path: '/tasks', icon: '✅' },
  { id: 'nav-notes', title: 'Notas', path: '/notes', icon: '📝' },
  { id: 'nav-logs', title: 'Logs', path: '/logs', icon: '📊' },
  { id: 'nav-chat', title: 'Chat', path: '/chat', icon: '💬' },
  { id: 'nav-settings', title: 'Configurações', path: '/settings', icon: '⚙️' },
];
