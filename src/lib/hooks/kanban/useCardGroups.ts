import { useState, useEffect, useCallback } from 'react';
import * as groupsApi from '@/lib/api/kanban/kanbanCardGroups';
import * as cardsApi from '@/lib/api/kanban/kanbanCards';
import type { ParentCardGroup, KanbanCard } from '@/types/kanban.types';

export function useCardGroups(parentCardId: string) {
  const [groups, setGroups] = useState<ParentCardGroup[]>([]);
  const [cardsByGroup, setCardsByGroup] = useState<Record<string, KanbanCard[]>>({});
  const [ungroupedCards, setUngroupedCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const groupList = await groupsApi.getGroupsByParentCard(parentCardId);
    setGroups(groupList);
    const entries = await Promise.all(groupList.map(async (g) => [g.id, await cardsApi.getCardsByGroup(g.id)] as const));
    setCardsByGroup(Object.fromEntries(entries));
    const loose = await cardsApi.getUngroupedCardsByParentCard(parentCardId);
    setUngroupedCards(loose);
    setLoading(false);
  }, [parentCardId]);

  useEffect(() => { reload(); }, [reload]);

  const createGroup = useCallback(async (name: string) => {
    await groupsApi.createGroupForParentCard(parentCardId, name);
    await reload();
  }, [parentCardId, reload]);

  const renameGroup = useCallback(async (id: string, name: string) => {
    await groupsApi.renameParentCardGroup(id, name);
    await reload();
  }, [reload]);

  /** Desagrupa (NÃO apaga os cards) — eles voltam soltos, vinculados direto ao card-pai. */
  const removeGroup = useCallback(async (id: string) => {
    await groupsApi.deleteParentCardGroup(id);
    await reload();
  }, [reload]);

  const reorderGroupsLocally = useCallback((orderedIds: string[]) => {
    setGroups((prev) => {
      const map = new Map(prev.map((g) => [g.id, g]));
      return orderedIds.map((id) => map.get(id)).filter((g): g is ParentCardGroup => !!g);
    });
  }, []);

  const reorderGroups = useCallback(async (orderedIds: string[]) => {
    reorderGroupsLocally(orderedIds);
    try {
      await groupsApi.reorderParentCardGroups(parentCardId, orderedIds);
    } catch {
      await reload();
    }
  }, [parentCardId, reorderGroupsLocally, reload]);

  const createCardInGroup = useCallback(async (groupId: string, title: string) => {
    await cardsApi.createCard({ cardGroupId: groupId, title });
    await reload();
  }, [reload]);

  /** Move um card solto (ungroupedCards) pra dentro de um grupo. */
  const moveCardIntoGroup = useCallback(async (cardId: string, groupId: string, orderedIds: string[]) => {
    await cardsApi.moveCardIntoGroup(cardId, groupId, orderedIds);
    await reload();
  }, [reload]);

  const duplicateCard = useCallback(async (id: string) => {
    await cardsApi.duplicateCard(id);
    await reload();
  }, [reload]);

  const removeCard = useCallback(async (id: string) => {
    await cardsApi.deleteCard(id);
    await reload();
  }, [reload]);

  const reorderCardsInGroup = useCallback(async (groupId: string, orderedCardIds: string[]) => {
    setCardsByGroup((prev) => {
      const map = new Map((prev[groupId] ?? []).map((c) => [c.id, c]));
      return { ...prev, [groupId]: orderedCardIds.map((id) => map.get(id)).filter((c): c is KanbanCard => !!c) };
    });
    try {
      await cardsApi.reorderCardsInGroup(orderedCardIds);
    } catch {
      await reload();
    }
  }, [reload]);

  return {
    groups, cardsByGroup, ungroupedCards, loading, reload,
    createGroup, renameGroup, removeGroup, reorderGroups,
    createCardInGroup, moveCardIntoGroup, duplicateCard, removeCard, reorderCardsInGroup,
  };
}
