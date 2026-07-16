import { useState, useEffect, useCallback } from 'react';
import { getAllProjects } from '@/lib/api/projects';
import type { ProjectType } from '@/types/project.types';
import { buildProjectBreadcrumbPath } from '@/Projects/utils/projectBreadcrumb';

/**
 * refreshToken: incrementar de fora força recarregar sem precisar remontar o
 * componente inteiro (ex: depois de renomear o projeto atual em outro modal).
 */
export function useProjectBreadcrumb(projectId: string, refreshToken = 0) {
  const [allProjects, setAllProjects] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await getAllProjects();
    setAllProjects(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload, projectId, refreshToken]);

  const path = buildProjectBreadcrumbPath(allProjects, projectId);

  return { path, loading, reload };
}
