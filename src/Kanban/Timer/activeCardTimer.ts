import { invoke } from '@tauri-apps/api/core';

export interface PersistedActiveCardTimer {
  projectId: string;
  cardId: string;
  cardTitle: string;
  sessionTitle: string;
  sessionDescription: string;
  elapsedSeconds: number;
  sessionStartedAt: string;
  resumingSessionId: string | null;
}

export async function loadActiveCardTimer(): Promise<PersistedActiveCardTimer | null> {
  const raw = await invoke<string>('load_active_card_timer');
  try {
    return JSON.parse(raw) ?? null;
  } catch {
    return null;
  }
}

export async function saveActiveCardTimer(data: PersistedActiveCardTimer): Promise<void> {
  await invoke('save_active_card_timer', { data: JSON.stringify(data) });
}

export async function clearActiveCardTimer(): Promise<void> {
  await invoke('clear_active_card_timer');
}
