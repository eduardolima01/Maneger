import { useState, useEffect, useCallback } from 'react';
import * as agendaApi from '@/Projects/Project/modules/agenda/api/agenda';
import type { Event, CreateEventInput, UpdateEventInput } from '@/types/event.types';

export function useProjectEvents(projectId: string) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agendaApi.loadAgendaData(projectId);
      setEvents(data.events);
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
    await agendaApi.createProjectEvent(projectId, input);
    await reload();
  }, [projectId, reload]);

  const update = useCallback(async (id: string, input: UpdateEventInput) => {
    await agendaApi.updateProjectEvent(projectId, id, input);
    await reload();
  }, [projectId, reload]);

  const remove = useCallback(async (id: string) => {
    await agendaApi.deleteProjectEvent(projectId, id);
    await reload();
  }, [projectId, reload]);

  return { events, loading, error, create, update, remove, reload };
}
