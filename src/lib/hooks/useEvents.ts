import { useState, useEffect, useCallback } from 'react';
import * as eventsApi from '../api/events';
import type { Event, CreateEventInput, UpdateEventInput } from '@/types/event.types';

export function useEvents(rangeStartISO: string, rangeEndISO: string) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await eventsApi.getEventsByRange(rangeStartISO, rangeEndISO);
      setEvents(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  }, [rangeStartISO, rangeEndISO]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(async (input: CreateEventInput) => {
    await eventsApi.createEvent(input);
    await reload();
  }, [reload]);

  const update = useCallback(async (id: number, input: UpdateEventInput) => {
    await eventsApi.updateEvent(id, input);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: number) => {
    await eventsApi.deleteEvent(id);
    await reload();
  }, [reload]);

  return { events, loading, error, create, update, remove, reload };
}
