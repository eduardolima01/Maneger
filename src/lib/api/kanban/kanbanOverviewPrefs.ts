import { invoke } from '@tauri-apps/api/core';

export interface KanbanOverviewPrefs {
  pinnedKanbanIds: string[];
  hiddenKanbanIds: string[];
}

function defaultPrefs(): KanbanOverviewPrefs {
  return { pinnedKanbanIds: [], hiddenKanbanIds: [] };
}

export async function loadKanbanOverviewPrefs(): Promise<KanbanOverviewPrefs> {
  const raw = await invoke<string>('load_kanban_overview_prefs');
  try {
    const parsed = JSON.parse(raw);
    return { ...defaultPrefs(), ...parsed };
  } catch {
    return defaultPrefs();
  }
}

export async function saveKanbanOverviewPrefs(prefs: KanbanOverviewPrefs): Promise<void> {
  await invoke('save_kanban_overview_prefs', { data: JSON.stringify(prefs, null, 2) });
}
