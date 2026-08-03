import { invoke } from '@tauri-apps/api/core';
import type { PomodoroData } from '../types/pomodoro.types';
import { defaultPomodoroData } from '../types/pomodoro.types';

export async function loadPomodoroData(projectId: string): Promise<PomodoroData> {
  const raw = await invoke<string>('load_pomodoro_data', { projectId });
  try {
    const parsed = JSON.parse(raw);
    return { ...defaultPomodoroData(), ...parsed };
  } catch {
    return defaultPomodoroData();
  }
}

export async function savePomodoroData(projectId: string, data: PomodoroData): Promise<void> {
  await invoke('save_pomodoro_data', { projectId, data: JSON.stringify(data, null, 2) });
}

// load + append + save — usado pelo timer global (evita sobrescrever com estado otimista desatualizado)
export async function appendPomodoroSession(projectId: string, session: import('../types/pomodoro.types').PomodoroSession): Promise<void> {
  const current = await loadPomodoroData(projectId);
  const next = { ...current, sessions: [session, ...current.sessions] };
  await savePomodoroData(projectId, next);
}

