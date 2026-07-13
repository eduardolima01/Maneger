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

  return { groups, loading, create, rename, remove, reload };
}
