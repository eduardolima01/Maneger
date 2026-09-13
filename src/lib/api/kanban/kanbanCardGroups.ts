import { loadKanbanData, saveKanbanData } from '@/Kanban/api/kanbanDataStore';
import { generateId } from '@/lib/utils/uuid';
import type { KanbanCardGroup, ParentCardGroup } from '@/types/kanban.types';

export async function getGroupsByKanban(kanbanId: string): Promise<KanbanCardGroup[]> {
  const data = await loadKanbanData();
  return data.cardGroups
    .filter((g) => g.kanbanId === kanbanId)
    .sort((a, b) => a.position - b.position);
}

export async function createGroup(kanbanId: string, columnId: string, name: string): Promise<string> {
  const data = await loadKanbanData();
  const id = generateId();

  const siblings = data.cardGroups.filter((g) => g.columnId === columnId);
  const nextPosition = siblings.length > 0 ? Math.max(...siblings.map((g) => g.position)) + 1 : 0;

  data.cardGroups.push({ id, kanbanId, columnId, name, position: nextPosition });
  await saveKanbanData(data);
  return id;
}

export async function renameGroup(id: string, name: string): Promise<void> {
  const data = await loadKanbanData();
  const group = data.cardGroups.find((g) => g.id === id);
  if (!group) return;
  group.name = name;
  await saveKanbanData(data);
}

/**
 * Move o grupo (com todos os cards dele, que não mudam de group_id) pra outra coluna.
 * `orderedGroupAndCardIdsInColumn` é uma lista mista de ids de grupo E de card na mesma
 * coluna (mesmo comportamento do original: só os ids que batem com um grupo de verdade
 * têm a posição atualizada aqui; ids de card na lista são ignorados por esta função).
 */
export async function moveGroupToColumn(groupId: string, targetColumnId: string, orderedGroupAndCardIdsInColumn: string[]): Promise<void> {
  const data = await loadKanbanData();
  const group = data.cardGroups.find((g) => g.id === groupId);
  if (group) group.columnId = targetColumnId;

  orderedGroupAndCardIdsInColumn.forEach((id, index) => {
    const g = data.cardGroups.find((g) => g.id === id);
    if (g) g.position = index;
  });

  await saveKanbanData(data);
}

export async function reorderGroupPosition(orderedGroupIds: string[]): Promise<void> {
  const data = await loadKanbanData();
  orderedGroupIds.forEach((id, index) => {
    const g = data.cardGroups.find((g) => g.id === id);
    if (g) g.position = index;
  });
  await saveKanbanData(data);
}

/** Exclui o grupo SEM apagar os cards — eles voltam soltos pra coluna do grupo. */
export async function deleteGroupAndUngroupCards(id: string, kanbanId: string, columnId: string): Promise<void> {
  const data = await loadKanbanData();

  const siblings = data.cards.filter((c) => c.columnId === columnId);
  let nextPosition = siblings.length > 0 ? Math.max(...siblings.map((c) => c.position)) + 1 : 0;

  for (const card of data.cards) {
    if (card.cardGroupId === id) {
      card.cardGroupId = null;
      card.kanbanId = kanbanId;
      card.columnId = columnId;
      card.position = nextPosition++;
    }
  }

  data.cardGroups = data.cardGroups.filter((g) => g.id !== id);

  await saveKanbanData(data);
}

// ---------------------------------------------------------------------------
// Fluxo separado: grupos de cards vinculados só a um card-pai (sem kanban/coluna).
// Usado por src/lib/hooks/kanban/useCardGroups.ts + CardGroupsSection.tsx.
// ---------------------------------------------------------------------------

export async function getGroupsByParentCard(parentCardId: string): Promise<ParentCardGroup[]> {
  const data = await loadKanbanData();
  return data.parentCardGroups
    .filter((g) => g.parentCardId === parentCardId)
    .sort((a, b) => a.position - b.position);
}

export async function createGroupForParentCard(parentCardId: string, name: string): Promise<string> {
  const data = await loadKanbanData();
  const id = generateId();

  const siblings = data.parentCardGroups.filter((g) => g.parentCardId === parentCardId);
  const nextPosition = siblings.length > 0 ? Math.max(...siblings.map((g) => g.position)) + 1 : 0;

  data.parentCardGroups.push({ id, parentCardId, name, position: nextPosition });
  await saveKanbanData(data);
  return id;
}

export async function renameParentCardGroup(id: string, name: string): Promise<void> {
  const data = await loadKanbanData();
  const group = data.parentCardGroups.find((g) => g.id === id);
  if (!group) return;
  group.name = name;
  await saveKanbanData(data);
}

/**
 * Desagrupa (NÃO apaga os cards): eles ficam soltos, vinculados direto ao
 * card-pai via `parentCardId`, com `cardGroupId: null`.
 */
export async function deleteParentCardGroup(id: string): Promise<void> {
  const data = await loadKanbanData();
  const group = data.parentCardGroups.find((g) => g.id === id);
  if (!group) return;

  for (const card of data.cards) {
    if (card.cardGroupId === id) {
      card.cardGroupId = null;
      card.parentCardId = group.parentCardId;
    }
  }

  data.parentCardGroups = data.parentCardGroups.filter((g) => g.id !== id);
  await saveKanbanData(data);
}

export async function reorderParentCardGroups(parentCardId: string, orderedIds: string[]): Promise<void> {
  const data = await loadKanbanData();
  orderedIds.forEach((id, index) => {
    const group = data.parentCardGroups.find((g) => g.id === id && g.parentCardId === parentCardId);
    if (group) group.position = index;
  });
  await saveKanbanData(data);
}
