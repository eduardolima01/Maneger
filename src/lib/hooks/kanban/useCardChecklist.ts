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

  /** Marca/desmarca o item como lista simples (sem estado, fora da conta de tarefas) — vale pro item e pros sub-itens. */
  const setSimple = useCallback(async (id: string, simple: boolean) => {
    await api.updateItem(id, { simple });
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

  /**
   * Arrastar e soltar: muda o pai do item e fixa a ordem dos filhos do destino (`orderedIds` = ids finais dos filhos
   * do novo pai, com o item na posição certa). Atualiza a tela na hora, antes de gravar, pra não "piscar" o lugar antigo.
   */
  const place = useCallback(async (id: string, newParentId: string | null, orderedIds: string[]) => {
    setItems((prev) => {
      const positionById = new Map(orderedIds.map((itemId, index) => [itemId, index]));
      return prev.map((item) => {
        if (item.id === id) return { ...item, parentItemId: newParentId, position: positionById.get(id) ?? item.position };
        return positionById.has(item.id) ? { ...item, position: positionById.get(item.id)! } : item;
      });
    });
    try {
      await api.placeItem(id, newParentId, orderedIds);
    } catch (err) {
      console.error(err); // destino inválido etc.: o reload abaixo devolve a tela ao que está gravado
    }
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

  /** Cola uma lista (texto) no fim da checklist, sem apagar nada. Devolve quantos itens foram colados. */
  const appendFromText = useCallback(async (text: string) => {
    const count = await api.appendFromText(cardId, text);
    await reload();
    return count;
  }, [cardId, reload]);

  return { items, loading, create, createSubItem, setStatus, setSimple, rename, remove, reorder, move, place, replaceAllFromText, appendFromText };
}
