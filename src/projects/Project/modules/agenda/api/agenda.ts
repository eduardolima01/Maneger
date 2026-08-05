import { invoke } from '@tauri-apps/api/core';
import { generateId } from '@/lib/utils/uuid';
import type { Event, CreateEventInput, UpdateEventInput } from '@/types/event.types';

export interface AgendaData {
  events: Event[];
}

export function defaultAgendaData(): AgendaData {
  return { events: [] };
}

export async function loadAgendaData(projectId: string): Promise<AgendaData> {
  const raw = await invoke<string>('load_agenda_data', { projectId });
  try {
    const parsed = JSON.parse(raw);
    return { ...defaultAgendaData(), ...parsed };
  } catch {
    return defaultAgendaData();
  }
}

export async function saveAgendaData(projectId: string, data: AgendaData): Promise<void> {
  await invoke('save_agenda_data', { projectId, data: JSON.stringify(data, null, 2) });
}

export async function createProjectEvent(
  projectId: string,
  input: Omit<CreateEventInput, 'project_id'>
): Promise<string> {
  const current = await loadAgendaData(projectId);
  const id = generateId();
  const event: Event = { id, project_id: projectId, ...input };
  await saveAgendaData(projectId, { ...current, events: [...current.events, event] });
  return id;
}

export async function updateProjectEvent(
  projectId: string,
  id: string,
  input: UpdateEventInput
): Promise<void> {
  const current = await loadAgendaData(projectId);
  const events = current.events.map((ev) => (ev.id === id ? { ...ev, ...input } : ev));
  await saveAgendaData(projectId, { ...current, events });
}

export async function deleteProjectEvent(projectId: string, id: string): Promise<void> {
  const current = await loadAgendaData(projectId);
  const events = current.events.filter((ev) => ev.id !== id);
  await saveAgendaData(projectId, { ...current, events });
}
