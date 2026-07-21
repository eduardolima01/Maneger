import { useState, useEffect, useCallback } from 'react';
import * as ideasApi from '@/lib/api/taskIdeas';
import type { TaskIdea } from '@/types/task/taskIdea.types';

export function useTaskIdeas(projectId: string) {
  const [ideas, setIdeas] = useState<TaskIdea[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await ideasApi.getIdeasByProject(projectId);
    setIdeas(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const add = useCallback(async (content: string) => {
    if (!content.trim()) return;
    await ideasApi.createIdea(projectId, content.trim());
    await reload();
  }, [projectId, reload]);

  const remove = useCallback(async (id: string) => {
    await ideasApi.deleteIdea(id);
    await reload();
  }, [reload]);

  return { ideas, loading, add, remove };
}
