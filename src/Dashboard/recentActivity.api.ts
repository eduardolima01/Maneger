import { invoke } from '@tauri-apps/api/core';

export type RecentActivityType = 'project_opened' | 'kanban_opened';

export interface RecentActivityEntry {
  type: RecentActivityType;
  id: string;
  label: string;
  projectId?: string;
  projectName?: string;
  timestamp: string;
}

export interface RecentActivityState {
  entries: RecentActivityEntry[];
}

function defaultRecentActivityState(): RecentActivityState {
  return { entries: [] };
}

export async function loadRecentActivityState(): Promise<RecentActivityState> {
  const raw = await invoke<string>('load_recent_activity_state');
  try {
    const parsed = JSON.parse(raw);
    return { ...defaultRecentActivityState(), ...parsed };
  } catch {
    return defaultRecentActivityState();
  }
}

export async function saveRecentActivityState(state: RecentActivityState): Promise<void> {
  await invoke('save_recent_activity_state', { data: JSON.stringify(state, null, 2) });
}
