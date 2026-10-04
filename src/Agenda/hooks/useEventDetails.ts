import { useCallback, useEffect, useState } from 'react';
import type { EventDetail } from '@/types/event.types';
import {
  getEventDetails,
  createEventDetail,
  updateEventDetail,
  deleteEventDetail,
  subscribeEventDetails,
  type EventDetailPatch,
} from '../api/EventDetails';

/**
 * Detalhes (linha do tempo) de um evento. `enabled = false` (ou eventId nulo)
 * não carrega nada — usado pra só buscar quando o bloco é alto o bastante
 * pra mostrar a linha do tempo.
 */
export function useEventDetails(eventId: string | null, enabled = true) {
  const [details, setDetails] = useState<EventDetail[]>([]);
  const active = enabled && eventId !== null;

  useEffect(() => {
    if (!active || !eventId) {
      setDetails([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await getEventDetails(eventId);
        if (!cancelled) setDetails(rows);
      } catch (err) {
        console.error('Erro ao carregar detalhamento do evento', err);
      }
    };
    load();
    const unsubscribe = subscribeEventDetails(eventId, load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [active, eventId]);

  /** Cria um detalhe no trecho (minutos desde o início do evento); devolve o id. */
  const add = useCallback(
    async (startOffset: number, endOffset: number): Promise<string | null> => {
      if (!eventId) return null;
      return createEventDetail(eventId, { start_offset: startOffset, end_offset: endOffset });
    },
    [eventId]
  );

  const update = useCallback(
    async (id: string, patch: EventDetailPatch) => {
      if (eventId) await updateEventDetail(id, eventId, patch);
    },
    [eventId]
  );

  const remove = useCallback(
    async (id: string) => {
      if (eventId) await deleteEventDetail(id, eventId);
    },
    [eventId]
  );

  return { details, add, update, remove };
}
