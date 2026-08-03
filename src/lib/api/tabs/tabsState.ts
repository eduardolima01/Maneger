import { invoke } from '@tauri-apps/api/core';

export interface PersistedTab {
  path: string;
  customTitle?: string;
  createdAt: string;
  updatedAt: string;
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
