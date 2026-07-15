import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api/logGroups';
import type { LogGroup } from '@/types/log.types';

export function useLogGroups(projectId: string) {
  const [groups, setGroups] = useState<LogGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await api.getLogGroupsByProject(projectId);
    setGroups(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (name: string, templateId: string) => {
    await api.createLogGroup({ projectId, templateId, name });
    await reload();
  }, [projectId, reload]);

  const rename = useCallback(async (id: string, name: string) => {
    await api.updateLogGroup(id, { name });
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await api.deleteLogGroup(id);
    await reload();
  }, [reload]);

  const reorderLocally = useCallback((orderedIds: string[]) => {
    setGroups((prev) => {
      const map = new Map(prev.map((g) => [g.id, g]));
      return orderedIds.map((id) => map.get(id)).filter((g): g is LogGroup => !!g);
    });
  }, []);

  const reorder = useCallback(async (orderedIds: string[]) => {
    reorderLocally(orderedIds);
    try {
      await api.reorderLogGroups(projectId, orderedIds);
    } catch {
      await reload();
    }
  }, [projectId, reorderLocally, reload]);

  return { groups, loading, create, rename, remove, reorder, reload };
}
