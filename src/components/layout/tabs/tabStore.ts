import { useEffect, useState } from 'react';
import { createRouter, createMemoryHistory } from '@tanstack/react-router';
import type { AppRouter } from '@/router';
import { loadTabsState, saveTabsState } from '@/lib/api/tabs/tabsState';
import { loadPageVisits, PageVisitEntry, savePageVisits } from './PageVisits';
import { FavoritePageEntry, loadFavoritePages, saveFavoritePages } from './FavoritePages';
import { buildTabRouteTree } from '@/router/routes';

export interface TabMeta {
  title: string;
  icon?: string;
  iconUrl?: string; // quando presente, tem prioridade sobre `icon` (ex: capa do projeto)
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
  /** Histórico de navegação DESSA aba (paths, na ordem visitada) + posição atual nele.
   *  Independente do histórico interno do TanStack Router — mantido à mão porque
   *  @tanstack/history não expõe canGoForward()/uma lista navegável, só back()/canGoBack(). */
  navHistory: string[];
  navIndex: number;
}

type Listener = () => void;

let tabs: AppTab[] = [];
let activeTabId: string | null = null;
let nextTabSeq = 1;
let initStarted = false;
let closedTabsStack: { path: string; customTitle?: string }[] = [];
let pageVisits: PageVisitEntry[] = [];
let favoritePages: FavoritePageEntry[] = [];
// ids de aba cuja PRÓXIMA resolução veio de goBackInTab/goForwardInTab/goToHistoryIndex —
// nesse caso não deve empilhar uma entrada nova, só confirmar a posição já movida.
const suppressNavLogForTab = new Set<string>();
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

// fallback estático — usado só enquanto a página ainda não reportou meta (ou pra rotas sem entidade, como Dashboard/Configurações)
const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard', '/projects': 'Projetos', '/projects/$projectId': 'Projeto',
  '/kanban': 'Kanban', '/kanban/$kanbanId': 'Kanban', '/agenda': 'Agenda',
  '/logs': 'Logs', '/chat': 'Chat', '/settings': 'Configurações',
  '/canvas': 'Canvas',
};

const ROUTE_ICONS: Record<string, string> = {
  '/': '🏠', '/projects': '📁', '/projects/$projectId': '📁',
  '/kanban': '📋', '/kanban/$kanbanId': '📋', '/agenda': '📅',
  '/logs': '📊', '/chat': '💬', '/settings': '⚙️',
  '/canvas': '🎨',
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

export function tabDisplayIconUrl(tab: AppTab): string | undefined {
  return tab.meta?.iconUrl;
}

export function tabTooltip(tab: AppTab): string {
  if (tab.meta?.breadcrumb?.length) return tab.meta.breadcrumb.join(' / ');
  return tabDisplayTitle(tab);
}

function persist() {
  const activeIndex = tabs.findIndex((t) => t.id === activeTabId);
  saveTabsState({
    tabs: tabs.map((t) => ({
      path: t.router.state.location.pathname,
      customTitle: t.customTitle,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
    // ids são renumerados por posição em initTabsFromDisk, então salvamos o id pós-restauração
    activeTabId: activeIndex === -1 ? null : `tab-${activeIndex + 1}`,
  }).catch(() => { });
}

// ---- Páginas mais acessadas -------------------------------------------------
// Contabiliza 1 visita por navegação resolvida (ver createTabRouter). Guardamos o
// routeId (padrão da rota, ex: '/projects/$projectId') junto do path exato, porque
// o path sozinho não dá pra resolver título/ícone de forma legível em rotas dinâmicas.

function trackPageVisit(path: string, routeId: string | undefined) {
  const now = new Date().toISOString();
  const existing = pageVisits.find((v) => v.path === path);
  if (existing) {
    existing.count += 1;
    existing.lastVisitedAt = now;
    existing.routeId = routeId ?? existing.routeId;
  } else {
    pageVisits = [...pageVisits, { path, routeId, count: 1, lastVisitedAt: now }];
  }
  savePageVisits({ visits: pageVisits }).catch(() => { });
  emit();
}

/**
 * Chamado por setTabMeta quando a página reporta seu meta ao vivo (nome/capa reais).
 * Preenche/atualiza title, icon e iconUrl na entrada de visita daquele path específico —
 * sem isso, "mais acessadas" ficaria travado no rótulo genérico do routeId (ex: "Projeto"
 * + ícone de pasta) mesmo depois da capa carregar.
 */
function enrichVisitedPageMeta(path: string, meta: TabMeta) {
  const entry = pageVisits.find((v) => v.path === path);
  if (!entry) return; // ainda não passou por trackPageVisit (não deveria acontecer, mas por segurança)
  const changed = entry.title !== meta.title || entry.icon !== meta.icon || entry.iconUrl !== meta.iconUrl;
  if (!changed) return;
  entry.title = meta.title;
  entry.icon = meta.icon;
  entry.iconUrl = meta.iconUrl;
  savePageVisits({ visits: pageVisits }).catch(() => { });
  emit();
}

export function pageVisitTitle(entry: PageVisitEntry): string {
  return entry.title ?? (entry.routeId && ROUTE_LABELS[entry.routeId]) ?? entry.path;
}

export function pageVisitIcon(entry: PageVisitEntry): string {
  return entry.icon ?? (entry.routeId && ROUTE_ICONS[entry.routeId]) ?? '🗂️';
}

export function pageVisitIconUrl(entry: PageVisitEntry): string | undefined {
  return entry.iconUrl;
}

/** As `limit` páginas com mais visitas, ordenadas da mais pra menos acessada. */
export function getMostVisitedPages(limit = 6): PageVisitEntry[] {
  return [...pageVisits].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function useMostVisitedPages(limit = 6): PageVisitEntry[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return getMostVisitedPages(limit);
}

// ---- Favoritos ---------------------------------------------------------------
// Favorito é uma propriedade da PÁGINA (path), não da aba em si — assim ele
// sobrevive ao fechar a aba, e a mesma página aberta em duas abas mostra o
// mesmo estado de favorito nas duas.

export function isPathFavorite(path: string): boolean {
  return favoritePages.some((f) => f.path === path);
}

export function toggleTabFavorite(id: string) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab) return;
  const path = tab.router.state.location.pathname;
  const existingIndex = favoritePages.findIndex((f) => f.path === path);

  if (existingIndex !== -1) {
    favoritePages = favoritePages.filter((_, i) => i !== existingIndex);
  } else {
    favoritePages = [
      ...favoritePages,
      {
        path,
        title: tabDisplayTitle(tab),
        icon: tabDisplayIcon(tab),
        iconUrl: tabDisplayIconUrl(tab),
        addedAt: new Date().toISOString(),
      },
    ];
  }
  saveFavoritePages({ favorites: favoritePages }).catch(() => { });
  emit();
}

export function getFavoritePages(): FavoritePageEntry[] {
  return favoritePages;
}

/**
 * Mesma ideia de enrichVisitedPageMeta: se o usuário favoritou a página antes dela
 * reportar meta (ex: capa do projeto ainda carregando), o favorito ficaria travado no
 * ícone genérico pra sempre. Atualiza título/ícone/capa do favorito existente daquele path.
 */
function enrichFavoritePageMeta(path: string, meta: TabMeta) {
  const entry = favoritePages.find((f) => f.path === path);
  if (!entry) return; // página não está favoritada, nada a enriquecer
  const changed = entry.title !== meta.title || entry.icon !== meta.icon || entry.iconUrl !== meta.iconUrl;
  if (!changed) return;
  entry.title = meta.title;
  entry.icon = meta.icon;
  entry.iconUrl = meta.iconUrl;
  saveFavoritePages({ favorites: favoritePages }).catch(() => { });
  emit();
}

export function useFavoritePages(): FavoritePageEntry[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return favoritePages;
}

// -------------------------------------------------------------------------------

// ---- Histórico de navegação por aba -------------------------------------------
// Cada aba mantém sua própria lista de paths visitados + um cursor. Comportamento
// de navegador: navegar pra um lugar novo enquanto o cursor não está na ponta descarta
// o trecho "pra frente" pendente (igual Chrome/Firefox).

function recordTabNavigation(tab: AppTab, path: string) {
  if (suppressNavLogForTab.has(tab.id)) {
    // resolução causada por goBackInTab/goForwardInTab/goToHistoryIndex — o cursor já
    // foi movido antes de chamar router.history.push(), só consome a flag aqui.
    suppressNavLogForTab.delete(tab.id);
    return;
  }
  if (tab.navHistory.length === 0) {
    // primeira resolução desta aba (recém-aberta ou restaurada do disco)
    tab.navHistory = [path];
    tab.navIndex = 0;
    return;
  }
  if (tab.navHistory[tab.navIndex] === path) {
    return; // resolveu de novo pro mesmo path (ex: refresh de dados) — não duplica
  }
  tab.navHistory = [...tab.navHistory.slice(0, tab.navIndex + 1), path];
  tab.navIndex = tab.navHistory.length - 1;
}

export function canGoBackInTab(id: string): boolean {
  const tab = tabs.find((t) => t.id === id);
  return !!tab && tab.navIndex > 0;
}

export function canGoForwardInTab(id: string): boolean {
  const tab = tabs.find((t) => t.id === id);
  return !!tab && tab.navIndex < tab.navHistory.length - 1;
}

function navigateTabToIndex(tab: AppTab, index: number) {
  tab.navIndex = index;
  suppressNavLogForTab.add(tab.id);
  // history.push (não navigate()) de propósito: mesma primitiva usada pra abrir a aba
  // com um path cru, sem depender de rotas tipadas pra cada path dinâmico já visitado.
  tab.router.history.push(tab.navHistory[index]);
  emit();
}

export function goBackInTab(id: string) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab || tab.navIndex <= 0) return;
  navigateTabToIndex(tab, tab.navIndex - 1);
}

export function goForwardInTab(id: string) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab || tab.navIndex >= tab.navHistory.length - 1) return;
  navigateTabToIndex(tab, tab.navIndex + 1);
}

export function goToTabHistoryIndex(id: string, index: number) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab || index < 0 || index >= tab.navHistory.length || index === tab.navIndex) return;
  navigateTabToIndex(tab, index);
}

export interface TabHistoryEntry {
  path: string;
  index: number;
  isCurrent: boolean;
}

/** Histórico da aba pronto pra exibir: título/ícone resolvidos via pageVisits (mesmo path). */
export function getTabNavHistory(id: string): TabHistoryEntry[] {
  const tab = tabs.find((t) => t.id === id);
  if (!tab) return [];
  return tab.navHistory.map((path, index) => ({ path, index, isCurrent: index === tab.navIndex }));
}

export function findPageVisit(path: string): PageVisitEntry | undefined {
  return pageVisits.find((v) => v.path === path);
}

export function useTabNavHistory(id: string | null): TabHistoryEntry[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return id ? getTabNavHistory(id) : [];
}

export function useTabNavState(id: string | null): { canGoBack: boolean; canGoForward: boolean } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  if (!id) return { canGoBack: false, canGoForward: false };
  return { canGoBack: canGoBackInTab(id), canGoForward: canGoForwardInTab(id) };
}

// -------------------------------------------------------------------------------

function createTabRouter(initialPath: string): AppRouter {
  const router = createRouter({
    routeTree: buildTabRouteTree(),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  }) as AppRouter;

  router.subscribe('onResolved', () => {
    const path = router.state.location.pathname;
    const tab = tabs.find((t) => t.router === router);
    if (tab) recordTabNavigation(tab, path);
    trackPageVisit(path, deepestRouteId(router));
    persist();
    emit();
  });

  return router;
}

export function openNewTab(initialPath = '/') {
  const id = `tab-${nextTabSeq++}`;
  const now = new Date().toISOString();
  tabs = [...tabs, { id, router: createTabRouter(initialPath), meta: null, createdAt: now, updatedAt: now, navHistory: [], navIndex: 0 }];
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

export function moveTab(fromId: string, toId: string) {
  if (fromId === toId) return;
  const from = tabs.findIndex((t) => t.id === fromId);
  const to = tabs.findIndex((t) => t.id === toId);
  if (from === -1 || to === -1) return;

  const next = [...tabs];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  tabs = next;

  persist();
  emit();
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

  const path = router.state.location.pathname;
  enrichVisitedPageMeta(path, meta);
  enrichFavoritePageMeta(path, meta);

  emit(); // não precisa persist() da aba em si: meta é derivado ao vivo, o `path` salvo já basta pra reidratar ao reabrir o app
}

export async function initTabsFromDisk() {
  if (initStarted) return;
  initStarted = true;

  const [state, visitsState, favoritesState] = await Promise.all([
    loadTabsState(),
    loadPageVisits(),
    loadFavoritePages(),
  ]);

  // atribuir ANTES de criar os routers: o primeiro 'onResolved' de cada aba restaurada
  // dispara trackPageVisit imediatamente, então pageVisits/favoritePages já precisam
  // refletir o que veio do disco nesse momento.
  pageVisits = visitsState.visits;
  favoritePages = favoritesState.favorites;

  tabs = state.tabs.map((persistedTab, i) => ({
    id: `tab-${i + 1}`,
    router: createTabRouter(persistedTab.path),
    customTitle: persistedTab.customTitle,
    meta: null,
    createdAt: persistedTab.createdAt ?? new Date().toISOString(),
    updatedAt: persistedTab.updatedAt ?? new Date().toISOString(),
    navHistory: [],
    navIndex: 0,
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

export function removeFavoritePage(path: string) {
  if (!favoritePages.some((f) => f.path === path)) return;
  favoritePages = favoritePages.filter((f) => f.path !== path);
  saveFavoritePages({ favorites: favoritePages }).catch(() => { });
  emit();
}
