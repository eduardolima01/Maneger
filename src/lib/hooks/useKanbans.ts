import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api/kanban/kanbans';
import type { Kanban, CreateKanbanInput } from '@/types/kanban.types';

export function useKanbans(projectId: string) {
  const [kanbans, setKanbans] = useState<Kanban[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await api.getKanbansByProject(projectId);
    setKanbans(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (input: Omit<CreateKanbanInput, 'projectId'>) => {
    const id = await api.createKanban({ ...input, projectId });
    await reload();
    return id;
  }, [projectId, reload]);

  const rename = useCallback(async (id: string, name: string) => {
    await api.updateKanban(id, { name });
    await reload();
  }, [reload]);

  const updateMeta = useCallback(async (id: string, input: Parameters<typeof api.updateKanban>[1]) => {
    await api.updateKanban(id, input);
    await reload();
  }, [reload]);

  const setDefault = useCallback(async (id: string) => {
    await api.setDefaultKanban(projectId, id);
    await reload();
  }, [projectId, reload]);

  const archive = useCallback(async (id: string, archived: boolean) => {
    await api.updateKanban(id, { archived });
    await reload();
  }, [reload]);

  const duplicate = useCallback(async (id: string) => {
    await api.duplicateKanban(id);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await api.deleteKanban(id);
    await reload();
  }, [reload]);

  const reorderLocally = useCallback((orderedIds: string[]) => {
    setKanbans((prev) => {
      const map = new Map(prev.map((k) => [k.id, k]));
      return orderedIds.map((id) => map.get(id)).filter((k): k is Kanban => !!k);
    });
  }, []);

  const reorder = useCallback(async (orderedIds: string[]) => {
    reorderLocally(orderedIds);
    try {
      await api.reorderKanbans(projectId, orderedIds);
    } catch {
      await reload();
    }
  }, [projectId, reorderLocally, reload]);

  return { kanbans, loading, reload, create, rename, updateMeta, setDefault, archive, duplicate, remove, reorder };
}
