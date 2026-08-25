import { useState, useEffect, useCallback, useMemo } from 'react'; import * as columnsApi from '@/lib/api/kanban/kanbanColumns';
import * as cardsApi from '@/lib/api/kanban/kanbanCards';
import * as kanbansApi from '@/lib/api/kanban/kanbans';
import type { KanbanColumn, KanbanFilters, KanbanCard, KanbanCardGroup, Kanban, KanbanViewPrefs, ChecklistProgress } from '@/types/kanban.types';
import { emptyFilters, hasActiveFilters } from '@/types/kanban.types';

import * as groupsApi from '@/lib/api/kanban/kanbanCardGroups';
import { getProgressByCardIds } from '../api/kanban/kanbanChecklist';
import * as checklistApi from '../api/kanban/kanbanChecklist';
import { parseLabel, serializeLabel } from '@/Kanban/utils/kanbanLabels';
import { generateDailyDates, generateNumberedTitles } from '@/Kanban/utils/kanbanGenerators';

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
    const newId = await cardsApi.duplicateCard(id);
    await checklistApi.duplicateChecklist(id, newId);
    await reload();
    return newId;
  }, [reload]);


  const duplicateCardMultiple = useCallback(async (
    id: string,
    mode: { kind: 'numbered'; count: number; startAt: number } | { kind: 'dates'; startDate: string; endDate: string }
  ) => {
    const original = cards.find((c) => c.id === id);
    if (!original) return;

    const dates = mode.kind === 'dates' ? generateDailyDates(mode.startDate, mode.endDate) : null;
    const count = mode.kind === 'numbered' ? mode.count : (dates?.length ?? 0);
    const titles = mode.kind === 'numbered' ? generateNumberedTitles(original.title, mode.count, mode.startAt) : null;
    if (count === 0) return; // intervalo inválido (data final antes da inicial)


    for (let i = 0; i < count; i++) {
      // reaproveita a mesma cópia de configuração (cor, prioridade, etiquetas, cardGroupId) e de tasks já usada na duplicação simples
      const newId = await cardsApi.duplicateCard(id);
      await checklistApi.duplicateChecklist(id, newId);
      if (titles) await cardsApi.updateCard(newId, { title: titles[i] });
      if (dates) await cardsApi.updateCard(newId, { dueDate: dates[i] });
    }
    await reload();
  }, [cards, reload]);

  const createCardsBatch = useCallback(async (columnId: string, titles: string[], dueDates?: (string | null)[]) => {
    for (let i = 0; i < titles.length; i++) {
      await cardsApi.createCard({ kanbanId, columnId, title: titles[i], dueDate: dueDates?.[i] ?? null });
    }
    await reload();
  }, [kanbanId, reload]); // sem mudança aqui — já era genérica o bastante, recebe titles/dueDates prontos

  const bulkMoveCards = useCallback(async (
    cardIds: string[],
    target: { kind: 'column'; columnId: string } | { kind: 'group'; groupId: string },
    orderedIds: string[]
  ) => {
    for (const id of cardIds) {
      if (target.kind === 'group') {
        await cardsApi.moveCardIntoGroup(id, target.groupId, orderedIds);
      } else {
        const card = cards.find((c) => c.id === id);
        if (card?.cardGroupId) {
          await cardsApi.moveCardOutOfGroup(id, kanbanId, target.columnId, orderedIds);
        } else {
          await cardsApi.moveCard(id, target.columnId, orderedIds);
        }
      }
    }
    await reload();
  }, [cards, kanbanId, reload]);

  const bulkDeleteCards = useCallback(async (cardIds: string[]) => {
    await Promise.all(cardIds.map((id) => cardsApi.deleteCard(id)));
    await reload();
  }, [reload]);

  const bulkSetColor = useCallback(async (cardIds: string[], color: string | null) => {
    await Promise.all(cardIds.map((id) => cardsApi.updateCard(id, { color })));
    await reload();
  }, [reload]);

  const bulkToggleLabel = useCallback(async (cardIds: string[], name: string, color: string, isGroup: boolean) => {
    // se ALGUM dos selecionados já tem a etiqueta, o clique remove de todos; senão, adiciona em todos
    // (mesmo critério de checkbox "indeterminado" usado em UIs de seleção múltipla)
    const targets = cardIds.map((id) => cards.find((c) => c.id === id)).filter((c): c is KanbanCard => !!c);
    const someHaveIt = targets.some((c) => c.labels.some((l) => parseLabel(l).name === name));
    await Promise.all(targets.map((c) => {
      const hasIt = c.labels.some((l) => parseLabel(l).name === name);
      const nextLabels = someHaveIt
        ? c.labels.filter((l) => parseLabel(l).name !== name)
        : hasIt ? c.labels : [...c.labels, serializeLabel(name, color, isGroup)];
      return cardsApi.updateCard(c.id, { labels: nextLabels });
    }));
    await reload();
  }, [cards, reload]);

  const archiveCard = useCallback(async (id: string, archived: boolean) => {
    await cardsApi.archiveCard(id, archived);
    await reload();
  }, [reload]);

  const removeCard = useCallback(async (id: string) => {
    await cardsApi.deleteCard(id);
    await reload();
  }, [reload]);

  const renameLabel = useCallback(async (oldName: string, newName: string, color: string, isGroup: boolean) => {
    const affected = cards.filter((c) => c.labels.some((l) => parseLabel(l).name === oldName));
    await Promise.all(
      affected.map((c) => {
        const nextLabels = c.labels.map((l) =>
          parseLabel(l).name === oldName ? serializeLabel(newName, color, isGroup) : l
        );
        return cardsApi.updateCard(c.id, { labels: nextLabels });
      })
    );
    await reload();
  }, [cards, reload]);

  const deleteLabel = useCallback(async (name: string) => {
    const affected = cards.filter((c) => c.labels.some((l) => parseLabel(l).name === name));
    await Promise.all(
      affected.map((c) => {
        const nextLabels = c.labels.filter((l) => parseLabel(l).name !== name);
        return cardsApi.updateCard(c.id, { labels: nextLabels });
      })
    );
    await reload();
  }, [cards, reload]);
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

  const fixInconsistentGroupLabels = useCallback(async () => {
    // descobre, por nome de etiqueta, se ELA é "de grupo" em qualquer card onde aparece
    const groupNames = new Set<string>();
    for (const card of cards) {
      for (const raw of card.labels) {
        const { name, isGroup } = parseLabel(raw);
        if (isGroup) groupNames.add(name);
      }
    }
    if (groupNames.size === 0) return;

    const affected = cards.filter((c) =>
      c.labels.some((l) => {
        const p = parseLabel(l);
        return groupNames.has(p.name) && !p.isGroup;
      })
    );
    if (affected.length === 0) return;

    await Promise.all(
      affected.map((c) => {
        const nextLabels = c.labels.map((l) => {
          const p = parseLabel(l);
          return groupNames.has(p.name) && !p.isGroup ? serializeLabel(p.name, p.color, true) : l;
        });
        return cardsApi.updateCard(c.id, { labels: nextLabels });
      })
    );
    await reload();
  }, [cards, reload]);

  return {
    columns, ungroupedCardsByColumn, cardsByGroup, groupsByColumn, cards, groups, cardsWithSubKanban, checklistProgress, loading, reload,
    search, setSearch, filters, setFilters, filtersActive: hasActiveFilters(filters),
    moveCard, createCard, updateCard, duplicateCard, archiveCard, removeCard,
    createCardInGroup,
    renameLabel, deleteLabel,
    fixInconsistentGroupLabels,
    createGroup, renameGroup, deleteGroup, moveCardIntoGroup, moveCardOutOfGroup, moveGroupToColumn,
    createColumn, updateColumn, removeColumn, duplicateColumn, reorderColumns,
    bulkMoveCards, bulkDeleteCards, bulkSetColor, bulkToggleLabel,
    duplicateCardMultiple, createCardsBatch,
    viewPrefs, saveViewPrefs,
  };
}

