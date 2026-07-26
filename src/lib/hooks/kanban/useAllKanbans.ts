import { useState, useEffect, useCallback } from 'react';

import { getAllKanbansWithProject } from '@/lib/api/kanban/kanbans';
import { ColumnCardCount, getCardCountsByColumnForKanbans } from '@/lib/api/kanban/kanbanCards';
import { KanbanWithProject } from '@/types/kanban.types';

export function useAllKanbans() {
  const [kanbans, setKanbans] = useState<KanbanWithProject[]>([]);
  const [columnCounts, setColumnCounts] = useState<Record<string, ColumnCardCount[]>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await getAllKanbansWithProject();
    setKanbans(data);
    const counts = await getCardCountsByColumnForKanbans(data.map((k) => k.id));
    setColumnCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { kanbans, columnCounts, loading, reload };
}
