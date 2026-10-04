import { invoke } from '@tauri-apps/api/core';

export interface PersistedTab {
  path: string;
  customTitle?: string;
  createdAt: string;
  updatedAt: string;
  /** Histórico de navegação (voltar/avançar) dessa aba. Opcional: arquivos salvos antes
   *  dessa funcionalidade existir não têm esse campo — tabStore.ts trata a ausência
   *  inicializando o histórico só com `path`. */
  navHistory?: string[];
  navIndex?: number;
}

export interface TabsState {
  tabs: PersistedTab[];
  activeTabId: string | null;
}

function defaultTabsState(): TabsState {
  return { tabs: [], activeTabId: null };
}

export async function loadTabsState(): Promise<TabsState> {
  const raw = await invoke<string>('load_tabs_state');
  try {
    const parsed = JSON.parse(raw);
    return { ...defaultTabsState(), ...parsed };
  } catch {
    return defaultTabsState();
  }
}

export async function saveTabsState(state: TabsState): Promise<void> {
  await invoke('save_tabs_state', { data: JSON.stringify(state, null, 2) });
}
