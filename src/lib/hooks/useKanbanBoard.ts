import { useState, useEffect, useCallback, useMemo } from 'react';
import * as columnsApi from '@/lib/api/kanban/kanbanColumns';
import * as cardsApi from '@/lib/api/kanban/kanbanCards';
import * as kanbansApi from '@/lib/api/kanban/kanbans';
import type { KanbanColumn, KanbanFilters, KanbanCard, KanbanCardGroup, Kanban, KanbanViewPrefs, ChecklistProgress } from '@/types/kanban.types';
import { emptyFilters, hasActiveFilters } from '@/types/kanban.types';

import * as groupsApi from '@/lib/api/kanban/kanbanCardGroups';
import { getProgressByCardIds } from '../api/kanban/kanbanChecklist';

export function useKanbanBoard(kanban: Kanban) {
  const kanbanId = kanban.id;
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [groups, setGroups] = useState<KanbanCardGroup[]>([]);
  const [cardsWithSubKanban, setCardsWithSubKanban] = useState<Set<string>>(new Set());
  const [checklistProgress, setChecklistProgress] = useState<Record<string, ChecklistProgress>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<KanbanFilters>(emptyFilters());
  const [viewPrefs, setViewPrefs] = useState<KanbanViewPrefs>(kanban.viewPrefs);

  useEffect(() => {
    setViewPrefs(kanban.viewPrefs);
  }, [kanban.id]);

  const reload = useCallback(async () => {
    setLoading(true);
    const [cols, cardList] = await Promise.all([
      columnsApi.getColumnsByKanban(kanbanId),
      cardsApi.getCardsByKanban(kanbanId),
    ]);
    setColumns(cols);
    setCards(cardList);
    const groupList = await groupsApi.getGroupsByKanban(kanbanId);
    setGroups(groupList);
    const subKanbanIds = await kanbansApi.getCardIdsWithSubKanban(cardList.map((c) => c.id));
    setCardsWithSubKanban(subKanbanIds);
    const progress = await getProgressByCardIds(cardList.map((c) => c.id));
    setChecklistProgress(progress);
    setLoading(false);
  }, [kanbanId]);

  useEffect(() => { reload(); }, [reload]);

  const ungroupedCardsByColumn = useMemo(() => {
    const term = search.trim().toLowerCase();
    const map = new Map<string, KanbanCard[]>();

    for (const card of cards) {
      if (card.cardGroupId) continue; // agrupados são tratados abaixo
      if (term) {
        const haystack = `${card.title} ${card.description ?? ''} ${card.labels.join(' ')}`.toLowerCase();
        if (!haystack.includes(term)) continue;
      }

      if (filters.priorities.length > 0 && (!card.priority || !filters.priorities.includes(card.priority))) continue;
      if (filters.labels.length > 0 && !filters.labels.some((l) => card.labels.includes(l))) continue;

      const list = map.get(card.columnId!) ?? [];
      list.push(card);
      map.set(card.columnId!, list);
    }

    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [cards, search, filters]);

  const cardsByGroup = useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    for (const card of cards) {
      if (!card.cardGroupId) continue;
      const list = map.get(card.cardGroupId) ?? [];
      list.push(card);
      map.set(card.cardGroupId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [cards]);

  const groupsByColumn = useMemo(() => {
    const map = new Map<string, KanbanCardGroup[]>();
    for (const g of groups) {
      const list = map.get(g.columnId) ?? [];
      list.push(g);
      map.set(g.columnId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [groups]);

  const createGroup = useCallback(async (columnId: string, name: string) => {
    await groupsApi.createGroup(kanbanId, columnId, name);
    await reload();
  }, [kanbanId, reload]);

  const renameGroup = useCallback(async (id: string, name: string) => {
    await groupsApi.renameGroup(id, name);
    await reload();
  }, [reload]);

  const deleteGroup = useCallback(async (id: string, columnId: string) => {
    await groupsApi.deleteGroupAndUngroupCards(id, kanbanId, columnId);
    await reload();
  }, [kanbanId, reload]);

  const moveCardIntoGroup = useCallback(async (cardId: string, groupId: string, orderedIds: string[]) => {
    await cardsApi.moveCardIntoGroup(cardId, groupId, orderedIds);
    await reload();
  }, [reload]);

  const moveCardOutOfGroup = useCallback(async (cardId: string, columnId: string, orderedIds: string[]) => {
    await cardsApi.moveCardOutOfGroup(cardId, kanbanId, columnId, orderedIds);
    await reload();
  }, [kanbanId, reload]);

  const moveGroupToColumn = useCallback(async (groupId: string, columnId: string, orderedIds: string[]) => {
    await groupsApi.moveGroupToColumn(groupId, columnId, orderedIds);
    await reload();
  }, [reload]);

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

  const createCardInGroup = useCallback(async (groupId: string, title: string) => {
    await cardsApi.createCard({ cardGroupId: groupId, title });
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
    setViewPrefs((prev) => {
      const next = { ...prev, ...partial };
      kanbansApi.updateKanban(kanbanId, { viewPrefs: next }).catch(() => {
      });
      return next;
    });
  }, [kanbanId]);

  return {
    columns, ungroupedCardsByColumn, cardsByGroup, groupsByColumn, cards, groups, cardsWithSubKanban, checklistProgress, loading, reload,
    search, setSearch, filters, setFilters, filtersActive: hasActiveFilters(filters),
    moveCard, createCard, updateCard, duplicateCard, archiveCard, removeCard,
    createCardInGroup,
    createGroup, renameGroup, deleteGroup, moveCardIntoGroup, moveCardOutOfGroup, moveGroupToColumn,
    createColumn, updateColumn, removeColumn, duplicateColumn, reorderColumns,
    viewPrefs, saveViewPrefs,
  };
}

