import { useState, useEffect, useCallback } from 'react';
import * as eventsApi from '@/lib/api/events';
import type { Event, CreateEventInput, UpdateEventInput } from '@/types/event.types';

export function useProjectEvents(projectId: string) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await eventsApi.getEventsByProject(projectId);
      setEvents(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(async (input: Omit<CreateEventInput, 'project_id'>) => {
    await eventsApi.createEvent({ ...input, project_id: projectId });
    await reload();
  }, [projectId, reload]);

  const update = useCallback(async (id: string, input: UpdateEventInput) => {
    await eventsApi.updateEvent(id, input);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await eventsApi.deleteEvent(id);
    await reload();
  }, [reload]);

  return { events, loading, error, create, update, remove, reload };
}
