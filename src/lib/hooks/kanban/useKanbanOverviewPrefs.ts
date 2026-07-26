import { useState, useEffect, useCallback } from 'react';
import { loadKanbanOverviewPrefs, saveKanbanOverviewPrefs } from '@/lib/api/kanban/kanbanOverviewPrefs';
import type { KanbanOverviewPrefs } from '@/lib/api/kanban/kanbanOverviewPrefs';

export function useKanbanOverviewPrefs() {
  const [prefs, setPrefs] = useState<KanbanOverviewPrefs>({ pinnedKanbanIds: [], hiddenKanbanIds: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKanbanOverviewPrefs().then((p) => { setPrefs(p); setLoading(false); });
  }, []);

  const togglePinned = useCallback((id: string) => {
    setPrefs((prev) => {
      const next: KanbanOverviewPrefs = {
        ...prev,
        pinnedKanbanIds: prev.pinnedKanbanIds.includes(id)
          ? prev.pinnedKanbanIds.filter((x) => x !== id)
          : [...prev.pinnedKanbanIds, id],
      };
      saveKanbanOverviewPrefs(next);
      return next;
    });
  }, []);

  const toggleHidden = useCallback((id: string) => {
    setPrefs((prev) => {
      const next: KanbanOverviewPrefs = {
        ...prev,
        hiddenKanbanIds: prev.hiddenKanbanIds.includes(id)
          ? prev.hiddenKanbanIds.filter((x) => x !== id)
          : [...prev.hiddenKanbanIds, id],
      };
      saveKanbanOverviewPrefs(next);
      return next;
    });
  }, []);

  return { prefs, loading, togglePinned, toggleHidden };
}
