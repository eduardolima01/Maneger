import { useState, useEffect, useCallback } from 'react';

import { getAllKanbansWithProject } from '@/lib/api/kanban/kanbans';
import { ColumnCardCount, getCardCountsByColumnForKanbans } from '@/lib/api/kanban/kanbanCards';
import { KanbanWithProject } from '@/types/kanban.types';
import { ProjectType } from '@/types/project.types';
import { getAllProjects } from '@/lib/api/projects';
import { buildProjectTree } from '@/lib/utils/projectTree';

export function useAllKanbans() {
  const [kanbans, setKanbans] = useState<KanbanWithProject[]>([]);
  const [columnCounts, setColumnCounts] = useState<Record<string, ColumnCardCount[]>>({});
  const [allProjects, setAllProjects] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await getAllKanbansWithProject();
    setKanbans(data);
    const counts = await getCardCountsByColumnForKanbans(data.map((k) => k.id));
    setColumnCounts(counts);

    const projects = await getAllProjects();
    setAllProjects(projects);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const tree = buildProjectTree(allProjects);

  return { kanbans, columnCounts, allProjects, tree, loading, reload };
}
