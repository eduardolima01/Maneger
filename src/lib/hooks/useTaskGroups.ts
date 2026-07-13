import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api/taskGroups';
import type { TaskGroup } from '@/types/task/group.types';

export function useTaskGroups(projectId: string) {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await api.getTaskGroupsByProject(projectId);
    setGroups(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (name: string) => {
    await api.createTaskGroup({ projectId, name });
    await reload();
  }, [projectId, reload]);

  const rename = useCallback(async (id: string, name: string) => {
    await api.updateTaskGroup(id, { name });
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await api.deleteTaskGroup(id);
    await reload();
  }, [reload]);

  const reorderLocally = useCallback((orderedIds: string[]) => {
    setGroups((prev) => {
      const map = new Map(prev.map((g) => [g.id, g]));
      return orderedIds.map((id) => map.get(id)).filter((g): g is TaskGroup => !!g);
    });
  }, []);

  const reorder = useCallback(async (orderedIds: string[]) => {
    reorderLocally(orderedIds);
    try {
      await api.reorderTaskGroups(projectId, orderedIds);
    } catch {
      await reload(); // falhou ao persistir — descarta o otimista, volta pro que está no banco
    }
  }, [projectId, reorderLocally, reload]);

  return { groups, loading, create, rename, remove, reorderLocally, reorder, reload };
}
