import { generateId } from '@/lib/utils/uuid';
import type { Event, CreateEventInput, UpdateEventInput } from '@/types/event.types';
import { getAgendaStore, saveAgendaStore, reanchorDetails } from './agendaStore';

// start_at/end_at são ISO local ('YYYY-MM-DDTHH:mm:ss'), então comparar como
// string é equivalente a comparar datas — o mesmo que o SQL fazia.
const byStart = (a: Event, b: Event) => (a.start_at < b.start_at ? -1 : a.start_at > b.start_at ? 1 : 0);

export async function getEventsByRange(startISO: string, endISO: string): Promise<Event[]> {
  const store = await getAgendaStore();
  return store.events.filter((e) => e.start_at < endISO && e.end_at > startISO).sort(byStart);
}

export async function getEventsByProject(projectId: string): Promise<Event[]> {
  const store = await getAgendaStore();
  return store.events.filter((e) => e.project_id === projectId).sort(byStart);
}

export async function createEvent(input: CreateEventInput): Promise<string> {
  const store = await getAgendaStore();
  const id = generateId();
  store.events.push({
    id,
    project_id: input.project_id,
    title: input.title,
    description: input.description ?? null,
    start_at: input.start_at,
    end_at: input.end_at,
  });
  await saveAgendaStore(store);
  return id;
}

export async function updateEvent(id: string, input: UpdateEventInput): Promise<void> {
  const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  if (Object.keys(patch).length === 0) return;

  const store = await getAgendaStore();
  const idx = store.events.findIndex((e) => e.id === id);
  if (idx < 0) return;

  // Cópia nova (nunca muta o objeto que o React pode estar segurando).
  const before = store.events[idx];
  const after = { ...before, ...patch };
  store.events[idx] = after;
  reanchorDetails(store, before, after); // detalhes acompanham mudanças de horário do evento
  await saveAgendaStore(store);
}

export async function deleteEvent(id: string): Promise<void> {
  const store = await getAgendaStore();
  store.events = store.events.filter((e) => e.id !== id);
  store.details = store.details.filter((d) => d.event_id !== id); // o "CASCADE" de antes
  await saveAgendaStore(store);
}

export async function getEventCountsByProject(): Promise<Record<string, number>> {
  const store = await getAgendaStore();
  const result: Record<string, number> = {};
  for (const e of store.events) {
    if (e.project_id) result[e.project_id] = (result[e.project_id] ?? 0) + 1;
  }
  return result;
}
