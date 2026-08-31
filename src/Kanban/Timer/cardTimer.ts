import { invoke } from '@tauri-apps/api/core';
import { CardTimerData, CardTimerSession, defaultCardTimerData } from './types/cardTimer.types';

export async function loadCardTimerData(projectId: string): Promise<CardTimerData> {
  const raw = await invoke<string>('load_card_timer_data', { projectId });
  try {
    return { ...defaultCardTimerData(), ...JSON.parse(raw) };
  } catch {
    return defaultCardTimerData();
  }
}

export async function saveCardTimerData(projectId: string, data: CardTimerData): Promise<void> {
  await invoke('save_card_timer_data', { projectId, data: JSON.stringify(data, null, 2) });
}

export async function getCardTimerSessions(projectId: string, cardId: string): Promise<CardTimerSession[]> {
  const data = await loadCardTimerData(projectId);
  return data.sessionsByCard[cardId] ?? [];
}

// load + append + save — mesmo padrão do Pomodoro (appendPomodoroSession), evita sobrescrever com estado otimista desatualizado
export async function appendCardTimerSession(projectId: string, cardId: string, session: CardTimerSession): Promise<void> {
  const current = await loadCardTimerData(projectId);
  const existing = current.sessionsByCard[cardId] ?? [];
  await saveCardTimerData(projectId, { ...current, sessionsByCard: { ...current.sessionsByCard, [cardId]: [session, ...existing] } });
}

export async function updateCardTimerSession(
  projectId: string, cardId: string, sessionId: string,
  patch: Partial<Pick<CardTimerSession, 'durationSeconds' | 'title' | 'description'>>
): Promise<void> {
  const current = await loadCardTimerData(projectId);
  const existing = current.sessionsByCard[cardId] ?? [];
  const updated = existing.map((s) => (s.id === sessionId ? { ...s, ...patch } : s));
  await saveCardTimerData(projectId, { ...current, sessionsByCard: { ...current.sessionsByCard, [cardId]: updated } });
}

export async function deleteCardTimerSession(projectId: string, cardId: string, sessionId: string): Promise<void> {
  const current = await loadCardTimerData(projectId);
  const existing = current.sessionsByCard[cardId] ?? [];
  const updated = existing.filter((s) => s.id !== sessionId);
  await saveCardTimerData(projectId, { ...current, sessionsByCard: { ...current.sessionsByCard, [cardId]: updated } });
}

export async function addSecondsToSession(projectId: string, cardId: string, sessionId: string, additionalSeconds: number, newEndAt: string): Promise<void> {
  const current = await loadCardTimerData(projectId);
  const existing = current.sessionsByCard[cardId] ?? [];
  const updated = existing.map((s) => (s.id === sessionId ? { ...s, durationSeconds: s.durationSeconds + additionalSeconds, endAt: newEndAt } : s));
  await saveCardTimerData(projectId, { ...current, sessionsByCard: { ...current.sessionsByCard, [cardId]: updated } });
}
