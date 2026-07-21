import { useState, useEffect, useCallback, useMemo } from 'react';
import * as columnsApi from '@/lib/api/kanban/kanbanColumns';
import * as cardsApi from '@/lib/api/kanban/kanbanCards';
import * as kanbansApi from '@/lib/api/kanban/kanbans';
import type { KanbanColumn, KanbanFilters, KanbanCard } from '@/types/kanban.types';
import { emptyFilters, hasActiveFilters } from '@/types/kanban.types';

export function useKanbanBoard(kanbanId: string) {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<KanbanFilters>(emptyFilters());

  const reload = useCallback(async () => {
    setLoading(true);
    // const [cols, cardList] = await Promise.all([
    //   columnsApi.getColumnsByKanban(kanbanId),
    //   cardsApi.getCardsByKanban(kanbanId),
    // ]);
    // setColumns(cols);
    // setCards(cardList);
    setLoading(false);
  }, [kanbanId]);

  useEffect(() => { reload(); }, [reload]);

  const cardsByColumn = useMemo(() => {
    const term = search.trim().toLowerCase();
    const map = new Map<string, KanbanCard[]>();

    for (const card of cards) {
      if (term) {
        const haystack = `${card.title} ${card.description ?? ''} ${card.labels.join(' ')}`.toLowerCase();
        if (!haystack.includes(term)) continue;
      }

      if (filters.priorities.length > 0 && (!card.priority || !filters.priorities.includes(card.priority))) continue;
      if (filters.labels.length > 0 && !filters.labels.some((l) => card.labels.includes(l))) continue;
      // `filters.types`/`hasSubtasks`/`completion` não se aplicam a Card (não tem tipo nem subtasks) — filtros ficam sem efeito nesses campos, tratados na UI (ver KanbanFilters)

      const list = map.get(card.columnId) ?? [];
      list.push(card);
      map.set(card.columnId, list);
    }

    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [cards, search, filters]);

  const moveCard = useCallback(async (cardId: string, targetColumnId: string, orderedCardIdsInColumn: string[]) => {
    setCards((prev) => {
      const updated = prev.map((c) => (c.id === cardId ? { ...c, columnId: targetColumnId } : c));
      const posMap = new Map(orderedCardIdsInColumn.map((id, i) => [id, i]));
      return updated.map((c) => (posMap.has(c.id) ? { ...c, position: posMap.get(c.id)! } : c));
    });
    try {
      await cardsApi.moveCard(cardId, targetColumnId, orderedCardIdsInColumn);
    } catch {
      await reload();
    }
  }, [reload]);

  const createCard = useCallback(async (columnId: string, title: string) => {
    await cardsApi.createCard({ kanbanId, columnId, title });
    await reload();
  }, [kanbanId, reload]);

  const updateCard = useCallback(async (id: string, input: Parameters<typeof cardsApi.updateCard>[1]) => {
    await cardsApi.updateCard(id, input);
    await reload();
  }, [reload]);

  const duplicateCard = useCallback(async (id: string) => {
    await cardsApi.duplicateCard(id);
    await reload();
  }, [reload]);

  const archiveCard = useCallback(async (id: string, archived: boolean) => {
    await cardsApi.archiveCard(id, archived);
    await reload();
  }, [reload]);

  const removeCard = useCallback(async (id: string) => {
    await cardsApi.deleteCard(id);
    await reload();
  }, [reload]);

  const createColumn = useCallback(async (name: string) => {
    await columnsApi.createColumn({ kanbanId, name });
    await reload();
  }, [kanbanId, reload]);

  const updateColumn = useCallback(async (id: string, input: Parameters<typeof columnsApi.updateColumn>[1]) => {
    await columnsApi.updateColumn(id, input);
    await reload();
  }, [reload]);

  const removeColumn = useCallback(async (id: string) => {
    await columnsApi.deleteColumn(id);
    await reload();
  }, [reload]);

  const duplicateColumn = useCallback(async (id: string) => {
    await columnsApi.duplicateColumn(id);
    await reload();
  }, [reload]);

  const reorderColumnsLocally = useCallback((orderedIds: string[]) => {
    setColumns((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      return orderedIds.map((id) => map.get(id)).filter((c): c is KanbanColumn => !!c);
    });
  }, []);

  const reorderColumns = useCallback(async (orderedIds: string[]) => {
    reorderColumnsLocally(orderedIds);
    try {
      await columnsApi.reorderColumns(kanbanId, orderedIds);
    } catch {
      await reload();
    }
  }, [kanbanId, reorderColumnsLocally, reload]);

  const saveViewPrefs = useCallback(async (partial: Partial<import('@/types/kanban.types').KanbanViewPrefs>) => {
    const kanban = await kanbansApi.getKanbanById(kanbanId);
    if (!kanban) return;
    await kanbansApi.updateKanban(kanbanId, { viewPrefs: { ...kanban.viewPrefs, ...partial } });
  }, [kanbanId]);

  return {
    columns, cardsByColumn, cards, loading, reload,
    search, setSearch, filters, setFilters, filtersActive: hasActiveFilters(filters),
    moveCard, createCard, updateCard, duplicateCard, archiveCard, removeCard,
    createColumn, updateColumn, removeColumn, duplicateColumn, reorderColumns,
    saveViewPrefs,
  };
}
