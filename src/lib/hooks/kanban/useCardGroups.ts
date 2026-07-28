import { useState, useEffect, useCallback } from 'react';
import * as groupsApi from '@/lib/api/kanban/kanbanCardGroups';
import * as cardsApi from '@/lib/api/kanban/kanbanCards';
import type { KanbanCardGroup, KanbanCard } from '@/types/kanban.types';

export function useCardGroups(parentCardId: string) {
  const [groups, setGroups] = useState<KanbanCardGroup[]>([]);
  const [cardsByGroup, setCardsByGroup] = useState<Record<string, KanbanCard[]>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const groupList = await groupsApi.getGroupsByParentCard(parentCardId);
    setGroups(groupList);
    const entries = await Promise.all(groupList.map(async (g) => [g.id, await cardsApi.getCardsByGroup(g.id)] as const));
    setCardsByGroup(Object.fromEntries(entries));
    setLoading(false);
  }, [parentCardId]);

  useEffect(() => { reload(); }, [reload]);

  const createGroup = useCallback(async (name: string) => {
    await groupsApi.createGroup(parentCardId, name);
    await reload();
  }, [parentCardId, reload]);

  const renameGroup = useCallback(async (id: string, name: string) => {
    await groupsApi.renameGroup(id, name);
    await reload();
  }, [reload]);

  const removeGroup = useCallback(async (id: string) => {
    await groupsApi.deleteGroup(id);
    await reload();
  }, [reload]);

  const reorderGroupsLocally = useCallback((orderedIds: string[]) => {
    setGroups((prev) => {
      const map = new Map(prev.map((g) => [g.id, g]));
      return orderedIds.map((id) => map.get(id)).filter((g): g is KanbanCardGroup => !!g);
    });
  }, []);

  const reorderGroups = useCallback(async (orderedIds: string[]) => {
    reorderGroupsLocally(orderedIds);
    try {
      await groupsApi.reorderGroups(parentCardId, orderedIds);
    } catch {
      await reload();
    }
  }, [parentCardId, reorderGroupsLocally, reload]);

  const createCardInGroup = useCallback(async (groupId: string, title: string) => {
    await cardsApi.createCard({ cardGroupId: groupId, title });
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
    groups, cardsByGroup, loading, reload,
    createGroup, renameGroup, removeGroup, reorderGroups,
    createCardInGroup, duplicateCard, removeCard, reorderCardsInGroup,
  };
}
