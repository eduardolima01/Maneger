import { invoke } from '@tauri-apps/api/core';
import type { ExplorerPrefs } from '../types/fileExplorer.types';

const EMPTY: ExplorerPrefs = { defaultPath: null, viewMode: 'icons' };

export async function loadExplorerPrefs(): Promise<ExplorerPrefs> {
  const raw = await invoke<string>('load_explorer_prefs');
  try {
    const parsed = JSON.parse(raw);
    return {
      defaultPath: typeof parsed.defaultPath === 'string' ? parsed.defaultPath : null,
      viewMode: ['icons', 'list', 'columns'].includes(parsed.viewMode) ? parsed.viewMode : 'icons',
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function saveExplorerPrefs(prefs: ExplorerPrefs): Promise<void> {
  await invoke('save_explorer_prefs', { data: JSON.stringify(prefs) });
}
