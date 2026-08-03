import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import SearchOverlay from './SearchOverlay';
import { useSearchWidgetState } from '../hooks/useSearchWidgetState';
import { searchRegistry } from '../services/searchRegistry';
import { createNavigationProvider } from '../providers/navigation.provider';
import { createActionsProvider } from '../providers/actions.provider';
import { createProjectsProvider, createSubprojectsProvider } from '../providers/projects.provider';
import { createKanbansProvider } from '../providers/kanbans.provider';
import { createTasksProvider } from '../providers/tasks.provider';
import { createNotesProvider } from '../providers/notes.provider';
import { createLogsProvider } from '../providers/logs.provider';
import { createSettingsProvider } from '../providers/settings.provider';
import { getKanbanById } from '@/lib/api/kanban/kanbans';
import { openGlobalKanbanModal } from '@/Kanban/globalKanbanModal';
import type { RecentEntry } from '../types/search.types';
import { activateNextTab, activatePrevTab, closeActiveTab, reopenLastClosedTab } from '@/components/layout/tabs/tabStore';

let providersRegistered = false;

export default function GlobalSearchWidget() {
  const { open, openSearch, closeSearch, openToken } = useSearchWidgetState();
  const navigate = useNavigate();
  const navigateFn = useRef((path: string) => navigate({ to: path }));

  useEffect(() => {
    if (providersRegistered) return; // registra os providers uma única vez por sessão do app
    providersRegistered = true;
    const nav = navigateFn.current;
    searchRegistry.register(createNavigationProvider(nav));
    searchRegistry.register(createActionsProvider(nav));
    searchRegistry.register(createProjectsProvider(nav));
    searchRegistry.register(createSubprojectsProvider(nav));
    searchRegistry.register(createKanbansProvider());
    searchRegistry.register(createTasksProvider(nav));
    searchRegistry.register(createNotesProvider(nav));
    searchRegistry.register(createLogsProvider(nav));
    searchRegistry.register(createSettingsProvider(nav));
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault(); // impede o "localizar na página" nativo do WebView
        openSearch();
        return;
      }
      if (e.key === 'Escape' && open) {
        closeSearch();
        return;
      }

      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) activatePrevTab(); else activateNextTab();
        return;
      }
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        closeActiveTab();
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        reopenLastClosedTab();
        return;
      }
    }

    // captura em fase de captura (true) — "bloquear atalhos da aplicação enquanto estiver aberta"
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, openSearch, closeSearch]);

  function resolveRecentAction(entry: RecentEntry): (() => void) | null {
    // reconstrói a ação a partir da categoria salva — recentEntries não guardam a função onSelect (não é serializável em JSON)
    switch (entry.category) {
      case 'navigation': return () => navigateFn.current(NAV_PATH_BY_ID[entry.id] ?? '/');
      case 'projects':
      case 'subprojects': return () => navigateFn.current(`/projects/${entry.id}`);
      case 'kanbans': return () => { getKanbanById(entry.id).then(openGlobalKanbanModal); };
      case 'tasks':
      case 'notes':
      case 'logs': return null; // precisariam do projectId salvo junto — não persistido no RecentEntry atual, ver nota abaixo
      case 'settings': return () => navigateFn.current('/settings');
      case 'actions': return () => navigateFn.current(ACTION_PATH_BY_ID[entry.id] ?? '/');
      default: return null;
    }
  }

  return <SearchOverlay open={open} focusToken={openToken} onClose={closeSearch} resolveRecentAction={resolveRecentAction} />;
}

const NAV_PATH_BY_ID: Record<string, string> = {
  'nav-dashboard': '/', 'nav-projects': '/projects', 'nav-kanban': '/kanban', 'nav-agenda': '/agenda',
  'nav-tasks': '/tasks', 'nav-notes': '/notes', 'nav-logs': '/logs', 'nav-chat': '/chat', 'nav-settings': '/settings',
};

const ACTION_PATH_BY_ID: Record<string, string> = {
  'action-new-project': '/projects', 'action-new-task': '/tasks', 'action-new-note': '/notes',
  'action-new-log': '/logs', 'action-new-kanban': '/kanban', 'action-open-chat': '/chat', 'action-open-settings': '/settings',
};
