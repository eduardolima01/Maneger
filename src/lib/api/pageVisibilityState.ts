import { invoke } from '@tauri-apps/api/core';

export interface PageVisibilityState {
  disabledRoutes: string[];
}

const EMPTY: PageVisibilityState = { disabledRoutes: [] };

export async function loadPageVisibility(): Promise<PageVisibilityState> {
  const raw = await invoke<string>('load_page_visibility_prefs');
  try {
    const parsed = JSON.parse(raw);
    return { disabledRoutes: Array.isArray(parsed.disabledRoutes) ? parsed.disabledRoutes : [] };
  } catch {
    return { ...EMPTY };
  }
}

export async function savePageVisibility(state: PageVisibilityState): Promise<void> {
  await invoke('save_page_visibility_prefs', { data: JSON.stringify(state) });
}
