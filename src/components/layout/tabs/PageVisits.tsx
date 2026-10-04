import { invoke } from '@tauri-apps/api/core';

export interface PageVisitEntry {
  path: string;
  /** routeId da rota (ex: '/projects/$projectId') — usado como FALLBACK de título/ícone
   *  (via ROUTE_LABELS/ROUTE_ICONS do tabStore) enquanto a página ainda não reportou meta. */
  routeId?: string;
  /** Título/ícone/capa reais, capturados quando a página reporta meta (ex: nome e capa
   *  do projeto específico). Têm prioridade sobre o fallback de routeId quando presentes. */
  title?: string;
  icon?: string;
  iconUrl?: string;
  count: number;
  lastVisitedAt: string;
}

export interface PageVisitsState {
  visits: PageVisitEntry[];
}

const EMPTY_STATE: PageVisitsState = { visits: [] };

export async function loadPageVisits(): Promise<PageVisitsState> {
  try {
    const raw = await invoke<string>('load_page_visits');
    const parsed = JSON.parse(raw);
    return { visits: Array.isArray(parsed.visits) ? parsed.visits : [] };
  } catch {
    return EMPTY_STATE;
  }
}

export async function savePageVisits(state: PageVisitsState): Promise<void> {
  await invoke('save_page_visits', { data: JSON.stringify(state) });
}
