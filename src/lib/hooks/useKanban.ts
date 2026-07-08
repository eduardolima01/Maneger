import { useState, useEffect, useCallback } from 'react';
import * as kanbanApi from '../api/kanban';
import type { KanbanCard, CreateKanbanCardInput, UpdateKanbanCardInput } from '../../types/kanbanCard.types';

export function useKanban(projectId: string) {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const data = await kanbanApi.getKanbanCardsByProject(projectId);
    setCards(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (input: CreateKanbanCardInput) => {
    await kanbanApi.createKanbanCard(input);
    await reload();
  }, [reload]);

  const update = useCallback(async (id: string, input: UpdateKanbanCardInput) => {
    await kanbanApi.updateKanbanCard(id, input);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await kanbanApi.deleteKanbanCard(id);
    await reload();
  }, [reload]);

  return { cards, loading, create, update, remove, reload };
}
