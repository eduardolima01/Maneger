import { generateId } from '@/lib/utils/uuid';
import type { EventDetail } from '@/types/event.types';
import { getAgendaStore, saveAgendaStore, eventDurationMin, nowSql } from '@/lib/api/agendaStore';

/**
 * Pub/sub mínimo por evento: o EventBlock (linha do tempo só de leitura) e o
 * EventInfoPopup (linha do tempo editável) podem estar abertos ao mesmo tempo
 * pro mesmo evento. Toda mutação avisa quem estiver ouvindo aquele evento, e
 * os hooks recarregam — assim os dois nunca ficam desatualizados.
 */
const listeners = new Map<string, Set<() => void>>();

export function subscribeEventDetails(eventId: string, callback: () => void): () => void {
  const set = listeners.get(eventId) ?? new Set<() => void>();
  set.add(callback);
  listeners.set(eventId, set);
  return () => {
    set.delete(callback);
    if (set.size === 0) listeners.delete(eventId);
  };
}

function notify(eventId: string) {
  listeners.get(eventId)?.forEach((cb) => cb());
}

export async function getEventDetails(eventId: string): Promise<EventDetail[]> {
  const store = await getAgendaStore();
  return store.details
    .filter((d) => d.event_id === eventId)
    .sort(
      (a, b) =>
        (a.start_offset ?? 0) - (b.start_offset ?? 0) ||
        (a.end_offset ?? 0) - (b.end_offset ?? 0) ||
        a.created_at.localeCompare(b.created_at)
    );
}

/** Garante 0 <= start < end <= duração do evento. */
function clampRange(start: number, end: number, duration: number): { start: number; end: number } {
  if (!Number.isFinite(duration) || duration <= 0) return { start: 0, end: 1 };
  const s = Math.min(Math.max(Math.round(start), 0), duration - 1);
  const e = Math.min(Math.max(Math.round(end), s + 1), duration);
  return { start: s, end: e };
}

export interface NewEventDetail {
  start_offset: number;
  end_offset: number;
  content?: string;
}

/** Cria um detalhe no trecho indicado (minutos desde o início do evento) e devolve o id. */
export async function createEventDetail(eventId: string, input: NewEventDetail): Promise<string> {
  const store = await getAgendaStore();
  const ev = store.events.find((e) => e.id === eventId);
  const range = clampRange(input.start_offset, input.end_offset, ev ? eventDurationMin(ev) : 0);

  const id = generateId();
  const nextPosition =
    store.details.filter((d) => d.event_id === eventId).reduce((max, d) => Math.max(max, d.position), -1) + 1;

  store.details.push({
    id,
    event_id: eventId,
    content: input.content ?? '',
    time_label: null,
    start_offset: range.start,
    end_offset: range.end,
    position: nextPosition,
    created_at: nowSql(),
  });
  await saveAgendaStore(store);
  notify(eventId);
  return id;
}

export interface EventDetailPatch {
  content?: string;
  start_offset?: number;
  end_offset?: number;
}

export async function updateEventDetail(id: string, eventId: string, patch: EventDetailPatch): Promise<void> {
  const store = await getAgendaStore();
  const idx = store.details.findIndex((d) => d.id === id);
  if (idx < 0) return;

  const current = store.details[idx];
  const next: EventDetail = { ...current };
  if (patch.content !== undefined) next.content = patch.content;

  if (patch.start_offset !== undefined || patch.end_offset !== undefined) {
    const ev = store.events.find((e) => e.id === eventId);
    const range = clampRange(
      patch.start_offset ?? current.start_offset ?? 0,
      patch.end_offset ?? current.end_offset ?? 1,
      ev ? eventDurationMin(ev) : 0
    );
    next.start_offset = range.start;
    next.end_offset = range.end;
  }

  store.details[idx] = next;
  await saveAgendaStore(store);
  notify(eventId);
}

export async function deleteEventDetail(id: string, eventId: string): Promise<void> {
  const store = await getAgendaStore();
  store.details = store.details.filter((d) => d.id !== id);
  await saveAgendaStore(store);
  notify(eventId);
}
