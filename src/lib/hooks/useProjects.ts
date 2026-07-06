import { useState, useEffect, useCallback } from 'react';
import { listProjects, createProject, deleteProject } from '../api/projects';
import { ProjectType } from '@/types/project.types';

export function useProjects() {
  const [projects, setProjects] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listProjects();
      setProjects(result);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = async (name: string) => {
    await createProject(name);
    await refresh();
  };

  const remove = async (id: number) => {
    await deleteProject(id);
    await refresh();
  };

  return { projects, loading, error, add, remove };
}
