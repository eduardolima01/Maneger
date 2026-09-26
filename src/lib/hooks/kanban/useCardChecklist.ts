import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '@/lib/api/kanban/kanbanChecklist';
import type { KanbanChecklistItem, ChecklistItemStatus } from '@/types/kanban.types';

export function useCardChecklist(cardId: string) {
  const [items, setItems] = useState<KanbanChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);

  const reload = useCallback(async () => {
    if (!hasLoadedOnce.current) setLoading(true);
    const data = await api.getItemsByCard(cardId);
    setItems(data);
    setLoading(false);
    hasLoadedOnce.current = true;
  }, [cardId]);

  useEffect(() => {
    hasLoadedOnce.current = false; // trocou de card → próxima carga volta a mostrar "Carregando..."
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

  const setStatus = useCallback(async (id: string, status: ChecklistItemStatus) => {
    await api.updateItem(id, { status });
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

  /** Muda o pai do item (null = tarefa principal); `afterItemId` = ficar logo depois desse irmão. */
  const move = useCallback(async (id: string, newParentId: string | null, afterItemId?: string) => {
    await api.moveItem(id, newParentId, afterItemId);
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

  /** Reconstrói a checklist inteira a partir de texto (modo texto ↔ visual). Ver aviso em kanbanChecklist.ts sobre ids. */
  const replaceAllFromText = useCallback(async (text: string) => {
    await api.replaceAllFromText(cardId, text);
    await reload();
  }, [cardId, reload]);

  return { items, loading, create, createSubItem, setStatus, rename, remove, reorder, move, replaceAllFromText };
}
