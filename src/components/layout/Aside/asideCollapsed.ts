import { invoke } from '@tauri-apps/api/core';

export interface AsideCollapsedState {
  collapsed: boolean;
}

export async function loadAsideCollapsed(): Promise<AsideCollapsedState | null> {
  const raw = await invoke<string>('load_aside_collapsed_prefs');
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed.collapsed === 'boolean' ? { collapsed: parsed.collapsed } : null;
  } catch {
    return null;
  }
}

export async function saveAsideCollapsed(state: AsideCollapsedState): Promise<void> {
  await invoke('save_aside_collapsed_prefs', { data: JSON.stringify(state) });
}
