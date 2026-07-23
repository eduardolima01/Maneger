import { useState, useEffect, useCallback } from 'react';
import { getAllProjects } from '@/lib/api/projects';
import type { ProjectType } from '@/types/project.types';
import { buildProjectBreadcrumbPath } from '@/Projects/utils/projectBreadcrumb';

export function useProjectBreadcrumbs() {
  const [allProjects, setAllProjects] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await getAllProjects();
    setAllProjects(data);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const resolveBreadcrumb = useCallback(
    (projectId: string | null): ProjectType[] => (projectId ? buildProjectBreadcrumbPath(allProjects, projectId) : []),
    [allProjects]
  );

  return { resolveBreadcrumb, loading, reload };
}
