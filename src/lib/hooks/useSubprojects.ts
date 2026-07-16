import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api/projects';
import type { ProjectType, CreateProjectInput } from '@/types/project.types';

export function useSubprojects(parentProjectId: string) {
  const [subprojects, setSubprojects] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const all = await api.getAllProjects();
    setSubprojects(
      all.filter((p) => p.parentProjectId === parentProjectId).sort((a, b) => a.position - b.position)
    );
    setLoading(false);
  }, [parentProjectId]);

  useEffect(() => { reload(); }, [reload]);

  const createProject = useCallback(async (input: Omit<CreateProjectInput, 'parentProjectId'>) => {
    const id = await api.createProject({ ...input, parentProjectId });
    await reload();
    return id;
  }, [parentProjectId, reload]);

  const remove = useCallback(async (id: string) => {
    await api.deleteProject(id);
    await reload();
  }, [reload]);

  const duplicate = useCallback(async (id: string) => {
    await api.duplicateProject(id);
    await reload();
  }, [reload]);

  const move = useCallback(async (id: string, newParentId: string | null) => {
    await api.moveProject(id, newParentId);
    await reload();
  }, [reload]);

  const reorderLocally = useCallback((orderedIds: string[]) => {
    setSubprojects((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      return orderedIds.map((id) => map.get(id)).filter((p): p is ProjectType => !!p);
    });
  }, []);

  const reorder = useCallback(async (orderedIds: string[]) => {
    reorderLocally(orderedIds);
    try {
      await api.reorderProjects(orderedIds);
    } catch {
      await reload();
    }
  }, [reorderLocally, reload]);

  return { subprojects, loading, reload, createProject, remove, duplicate, move, reorder };
}
