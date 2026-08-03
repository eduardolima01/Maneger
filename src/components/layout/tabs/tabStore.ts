import { useEffect, useState } from 'react';
import { createRouter, createMemoryHistory } from '@tanstack/react-router';
import type { AppRouter } from '@/router';
import { loadTabsState, saveTabsState } from '@/lib/api/tabs/tabsState';
import { buildTabRouteTree } from '@/router/routes';

export interface TabMeta {
  title: string;
  icon?: string;
  subtitle?: string;
  breadcrumb?: string[];
  status?: 'loading' | 'ready' | 'not-found';
}

export interface AppTab {
  id: string;
  router: AppRouter;
  customTitle?: string;
  meta: TabMeta | null; // reportado ao vivo pela página atual via useTabMeta() — null até a página montar e reportar
  createdAt: string;
  updatedAt: string;
}

type Listener = () => void;

let tabs: AppTab[] = [];
let activeTabId: string | null = null;
let nextTabSeq = 1;
let initStarted = false;
let closedTabsStack: { path: string; customTitle?: string }[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

// fallback estático — usado só enquanto a página ainda não reportou meta (ou pra rotas sem entidade, como Dashboard/Configurações)
const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard', '/projects': 'Projetos', '/projects/$projectId': 'Projeto',
  '/kanban': 'Kanban', '/kanban/$kanbanId': 'Kanban', '/agenda': 'Agenda',
  '/logs': 'Logs', '/chat': 'Chat', '/settings': 'Configurações',
};

const ROUTE_ICONS: Record<string, string> = {
  '/': '🏠', '/projects': '📁', '/projects/$projectId': '📁',
  '/kanban': '📋', '/kanban/$kanbanId': '📋', '/agenda': '📅',
  '/logs': '📊', '/chat': '💬', '/settings': '⚙️',
};

function deepestRouteId(router: AppRouter): string | undefined {
  const matches = router.state.matches;
  return matches[matches.length - 1]?.routeId;
}

function routeFallbackTitle(router: AppRouter): string {
  const id = deepestRouteId(router);
  return (id && ROUTE_LABELS[id]) ?? 'Nova aba';
}

function routeFallbackIcon(router: AppRouter): string {
  const id = deepestRouteId(router);
  return (id && ROUTE_ICONS[id]) ?? '🗂️';
}

export function tabDisplayTitle(tab: AppTab): string {
  // if (tab.customTitle) return tab.customTitle; // renomear manual sempre vence
  // if (tab.meta) return tab.meta.title;
  // return routeFallbackTitle(tab.router);
  return tab.customTitle ?? tabDefaultTitle(tab);
}


export function tabDefaultTitle(tab: AppTab): string {
  return tab.meta?.title ?? routeFallbackTitle(tab.router);
}
// breadcrumb: sempre reflete a navegação real, nunca editável
export function tabBreadcrumb(tab: AppTab): string[] {
  return tab.meta?.breadcrumb ?? [tabDefaultTitle(tab)];
}

export function tabDisplayIcon(tab: AppTab): string {
  if (tab.meta?.icon) return tab.meta.icon;
  return routeFallbackIcon(tab.router);
}

export function tabTooltip(tab: AppTab): string {
  if (tab.meta?.breadcrumb?.length) return tab.meta.breadcrumb.join(' / ');
  return tabDisplayTitle(tab);
}

function persist() {
  saveTabsState({
    tabs: tabs.map((t) => ({
      path: t.router.state.location.pathname,
      customTitle: t.customTitle,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
    activeTabId,
  }).catch(() => { });
}

function createTabRouter(initialPath: string): AppRouter {
  const router = createRouter({
    routeTree: buildTabRouteTree(),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  }) as AppRouter;

  router.subscribe('onResolved', () => {
    persist();
    emit();
  });

  return router;
}

export function openNewTab(initialPath = '/') {
  const id = `tab-${nextTabSeq++}`;
  const now = new Date().toISOString();
  tabs = [...tabs, { id, router: createTabRouter(initialPath), meta: null, createdAt: now, updatedAt: now }];
  activeTabId = id;
  persist();
  emit();
}

export function openEntityTab(path: string) {
  const existing = tabs.find((t) => t.router.state.location.pathname === path);
  if (existing) {
    activateTab(existing.id);
    return;
  }
  openNewTab(path);
}

export function openKanbanTab(kanbanId: string) {
  openEntityTab(`/kanban/${kanbanId}`);
}

export function closeTab(id: string) {
  const index = tabs.findIndex((t) => t.id === id);
  if (index === -1) return;

  closedTabsStack.push({ path: tabs[index].router.state.location.pathname, customTitle: tabs[index].customTitle });
  if (closedTabsStack.length > 10) closedTabsStack.shift(); // limite razoável, evita crescer sem fim

  tabs = tabs.filter((t) => t.id !== id);

  if (activeTabId === id) {
    // ativa a aba que "deslizou" pra posição da fechada (próxima; se era a última, a anterior)
    if (tabs.length === 0) {
      activeTabId = null;
    } else {
      const nextIndex = Math.min(index, tabs.length - 1);
      activeTabId = tabs[nextIndex].id;
    }
  }
  persist();
  emit();
}


export function closeActiveTab() {
  if (activeTabId) closeTab(activeTabId);
}

export function reopenLastClosedTab() {
  const last = closedTabsStack.pop();
  if (!last) return;
  openNewTab(last.path);
  if (last.customTitle) {
    const created = tabs[tabs.length - 1];
    created.customTitle = last.customTitle;
    persist();
    emit();
  }
}

// Ctrl+Tab / Ctrl+Shift+Tab — ciclo contínuo, só entre abas reais (Início não entra no ciclo)
export function activateNextTab() {
  if (tabs.length === 0) return;
  const i = tabs.findIndex((t) => t.id === activeTabId);
  activateTab(tabs[i === -1 ? 0 : (i + 1) % tabs.length].id);
}

export function activatePrevTab() {
  if (tabs.length === 0) return;
  const i = tabs.findIndex((t) => t.id === activeTabId);
  activateTab(tabs[i === -1 ? tabs.length - 1 : (i - 1 + tabs.length) % tabs.length].id);
}

export function activateTab(id: string | null) {
  activeTabId = id;
  persist();
  emit();
}

export function setCustomTitle(id: string, newTitle: string) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab) return;
  const trimmed = newTitle.trim();
  tab.customTitle = trimmed.length > 0 ? trimmed : undefined;
  tab.updatedAt = new Date().toISOString();
  persist();
  emit();
}

export function clearCustomTitle(id: string) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab) return;
  tab.customTitle = undefined;
  tab.updatedAt = new Date().toISOString();
  persist();
  emit();
}

// chamado pelo hook useTabMeta() — resolve a aba pela IDENTIDADE do router (useRouter() ambiente), sem acoplamento nenhum a tipos de entidade
export function setTabMeta(router: AppRouter, meta: TabMeta) {
  const tab = tabs.find((t) => t.router === router);
  if (!tab) return; // router global (Início) não é uma aba rastreada — no-op
  tab.meta = meta;
  emit(); // não precisa persist(): meta é derivado ao vivo, o `path` salvo já basta pra reidratar ao reabrir o app
}

export async function initTabsFromDisk() {
  if (initStarted) return;
  initStarted = true;

  const state = await loadTabsState();
  tabs = state.tabs.map((persistedTab, i) => ({
    id: `tab-${i + 1}`,
    router: createTabRouter(persistedTab.path),
    customTitle: persistedTab.customTitle,
    meta: null,
    createdAt: persistedTab.createdAt ?? new Date().toISOString(),
    updatedAt: persistedTab.updatedAt ?? new Date().toISOString(),
  }));
  nextTabSeq = tabs.length + 1;
  activeTabId = state.activeTabId && tabs.some((t) => t.id === state.activeTabId) ? state.activeTabId : null;
  emit();
}

export function useTabs(): { tabs: AppTab[]; activeTabId: string | null } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return { tabs, activeTabId };
}
