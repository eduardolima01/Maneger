import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api/kanban/kanbanChecklist';
import type { KanbanChecklistItem } from '@/types/kanban.types';

export function useCardChecklist(cardId: string) {
  const [items, setItems] = useState<KanbanChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await api.getItemsByCard(cardId);
    setItems(data);
    setLoading(false);
  }, [cardId]);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (title: string) => {
    if (!title.trim()) return;
    await api.createItem(cardId, title.trim());
    await reload();
  }, [cardId, reload]);

  const createSubItem = useCallback(async (parentItemId: string, title: string) => {
    if (!title.trim()) return;
    await api.createSubItem(cardId, parentItemId, title.trim());
    await reload();
  }, [cardId, reload]);

  const toggle = useCallback(async (id: string, checked: boolean) => {
    await api.updateItem(id, { checked });
    await reload();
  }, [reload]);

  const rename = useCallback(async (id: string, title: string) => {
    if (!title.trim()) return;
    await api.updateItem(id, { title: title.trim() });
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await api.deleteItem(id);
    await reload();
  }, [reload]);

  const reorderLocally = useCallback((orderedIds: string[]) => {
    setItems((prev) => {
      const positionById = new Map(orderedIds.map((id, index) => [id, index]));
      return prev.map((item) => (positionById.has(item.id) ? { ...item, position: positionById.get(item.id)! } : item));
    });
  }, []);

  const reorder = useCallback(async (orderedIds: string[]) => {
    reorderLocally(orderedIds);
    try {
      await api.reorderItems(orderedIds);
    } catch {
      await reload();
    }
  }, [reorderLocally, reload]);

  return { items, loading, create, createSubItem, toggle, rename, remove, reorder };
}

