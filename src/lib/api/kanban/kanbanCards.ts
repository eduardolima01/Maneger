import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import type { KanbanCard, CreateKanbanCardInput, UpdateKanbanCardInput } from '@/types/kanban.types';
import { loadKanbanData, saveKanbanData } from '@/Kanban/api/kanbanDataStore';

function applyPositions(cards: KanbanCard[], orderedIds: string[]): void {
  orderedIds.forEach((id, index) => {
    const card = cards.find((c) => c.id === id);
    if (card) card.position = index;
  });
}

export async function getCardsByKanban(kanbanId: string, includeArchived = false): Promise<KanbanCard[]> {
  const data = await loadKanbanData();
  const groupIdsInKanban = new Set(data.cardGroups.filter((g) => g.kanbanId === kanbanId).map((g) => g.id));
  return data.cards
    .filter((c) => c.kanbanId === kanbanId || (c.cardGroupId && groupIdsInKanban.has(c.cardGroupId)))
    .filter((c) => includeArchived || !c.archived)
    .sort((a, b) => a.position - b.position);
}

export async function getCardById(id: string): Promise<KanbanCard | null> {
  const data = await loadKanbanData();
  return data.cards.find((c) => c.id === id) ?? null;
}

export async function createCard(input: CreateKanbanCardInput): Promise<string> {
  const data = await loadKanbanData();
  const id = generateId();
  const now = toLocalISO(new Date());

  const siblings = input.cardGroupId
    ? data.cards.filter((c) => c.cardGroupId === input.cardGroupId)
    : data.cards.filter((c) => c.columnId === input.columnId);
  const nextPosition = siblings.length > 0 ? Math.max(...siblings.map((c) => c.position)) + 1 : 0;

  data.cards.push({
    id,
    kanbanId: input.kanbanId ?? null,
    columnId: input.columnId ?? null,
    cardGroupId: input.cardGroupId ?? null,
    title: input.title,
    description: input.description ?? null,
    coverPath: null,
    color: input.color ?? null,
    priority: input.priority ?? null,
    status: input.status ?? 'pendente',
    labels: input.labels ?? [],
    assignedTo: null,
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    position: nextPosition,
    archived: false,
    createdAt: now,
    updatedAt: now,
  });

  await saveKanbanData(data);
  return id;
}

export async function updateCard(id: string, input: UpdateKanbanCardInput): Promise<void> {
  const data = await loadKanbanData();
  const card = data.cards.find((c) => c.id === id);
  if (!card) return;

  let changed = false;
  if (input.title !== undefined) { card.title = input.title; changed = true; }
  if (input.description !== undefined) { card.description = input.description; changed = true; }
  if (input.coverPath !== undefined) { card.coverPath = input.coverPath; changed = true; }
  if (input.color !== undefined) { card.color = input.color; changed = true; }
  if (input.priority !== undefined) { card.priority = input.priority; changed = true; }
  if (input.status !== undefined) { card.status = input.status; changed = true; }
  if (input.labels !== undefined) { card.labels = input.labels; changed = true; }
  if (input.assignedTo !== undefined) { card.assignedTo = input.assignedTo; changed = true; }
  if (input.startDate !== undefined) { card.startDate = input.startDate; changed = true; }
  if (input.dueDate !== undefined) { card.dueDate = input.dueDate; changed = true; }
  if (input.columnId !== undefined) { card.columnId = input.columnId; changed = true; }
  if (input.archived !== undefined) { card.archived = input.archived; changed = true; }
  if (!changed) return;

  card.updatedAt = toLocalISO(new Date());
  await saveKanbanData(data);
}

/** Cascade manual: apaga também os checklist items do card (antes era ON DELETE CASCADE). */
export async function deleteCard(id: string): Promise<void> {
  const data = await loadKanbanData();
  data.checklistItems = data.checklistItems.filter((item) => item.cardId !== id);
  data.cards = data.cards.filter((c) => c.id !== id);
  await saveKanbanData(data);
}

export async function duplicateCard(id: string): Promise<string> {
  const data = await loadKanbanData();
  const original = data.cards.find((c) => c.id === id);
  if (!original) throw new Error('Card não encontrado para duplicar');
  return createCard({
    kanbanId: original.kanbanId,
    columnId: original.columnId,
    cardGroupId: original.cardGroupId ?? undefined,
    title: original.title,
    description: original.description,
    color: original.color,
    priority: original.priority,
    status: original.status,
    labels: original.labels,
    startDate: original.startDate,
    dueDate: original.dueDate,
  });
}

export async function archiveCard(id: string, archived: boolean): Promise<void> {
  await updateCard(id, { archived });
}

/** Move um card pra outra coluna e/ou reordena os cards da coluna de destino. */
export async function moveCard(cardId: string, targetColumnId: string, orderedCardIdsInColumn: string[]): Promise<void> {
  const data = await loadKanbanData();
  const card = data.cards.find((c) => c.id === cardId);
  if (card) card.columnId = targetColumnId;
  applyPositions(data.cards, orderedCardIdsInColumn);
  await saveKanbanData(data);
}

export async function reorderWithinColumn(orderedCardIds: string[]): Promise<void> {
  const data = await loadKanbanData();
  applyPositions(data.cards, orderedCardIds);
  await saveKanbanData(data);
}

export async function getCardCountsByKanbanIds(kanbanIds: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const id of kanbanIds) result[id] = 0;
  if (kanbanIds.length === 0) return result;

  const data = await loadKanbanData();
  for (const c of data.cards) {
    if (c.kanbanId && kanbanIds.includes(c.kanbanId) && !c.archived) {
      result[c.kanbanId] = (result[c.kanbanId] ?? 0) + 1;
    }
  }
  return result;
}

export interface ColumnCardCount {
  columnId: string;
  columnName: string;
  count: number;
}

export async function getCardCountsByColumnForKanbans(kanbanIds: string[]): Promise<Record<string, ColumnCardCount[]>> {
  const result: Record<string, ColumnCardCount[]> = {};
  for (const id of kanbanIds) result[id] = [];
  if (kanbanIds.length === 0) return result;

  const data = await loadKanbanData();
  const kanbanIdSet = new Set(kanbanIds);

  const relevantColumns = data.columns
    .filter((col) => kanbanIdSet.has(col.kanbanId) && col.visible)
    .sort((a, b) => a.position - b.position);

  for (const col of relevantColumns) {
    const count = data.cards.filter((c) => c.columnId === col.id && !c.archived).length;
    result[col.kanbanId].push({ columnId: col.id, columnName: col.name, count });
  }

  return result;
}

export async function reorderCardsInGroup(orderedCardIds: string[]): Promise<void> {
  const data = await loadKanbanData();
  applyPositions(data.cards, orderedCardIds);
  await saveKanbanData(data);
}

export async function getCardsByGroup(groupId: string): Promise<KanbanCard[]> {
  const data = await loadKanbanData();
  return data.cards
    .filter((c) => c.cardGroupId === groupId && !c.archived)
    .sort((a, b) => a.position - b.position);
}

export async function moveCardIntoGroup(cardId: string, groupId: string, orderedCardIdsInGroup: string[]): Promise<void> {
  const data = await loadKanbanData();
  const card = data.cards.find((c) => c.id === cardId);
  if (card) {
    card.cardGroupId = groupId;
    card.kanbanId = null;
    card.columnId = null;
  }
  applyPositions(data.cards, orderedCardIdsInGroup);
  await saveKanbanData(data);
}

export async function moveCardOutOfGroup(cardId: string, kanbanId: string, columnId: string, orderedIdsInColumn: string[]): Promise<void> {
  const data = await loadKanbanData();
  const card = data.cards.find((c) => c.id === cardId);
  if (card) {
    card.cardGroupId = null;
    card.kanbanId = kanbanId;
    card.columnId = columnId;
  }
  applyPositions(data.cards, orderedIdsInColumn);
  await saveKanbanData(data);
}

/**
 * Cards "soltos" (sem grupo) vinculados direto a um card-pai — resultado de
 * `deleteParentCardGroup`, ou de qualquer card criado futuramente já direto
 * no card-pai sem passar por um grupo. Ver ParentCardGroup em kanban.types.ts.
 */
export async function getUngroupedCardsByParentCard(parentCardId: string): Promise<KanbanCard[]> {
  const data = await loadKanbanData();
  return data.cards
    .filter((c) => c.parentCardId === parentCardId && !c.cardGroupId && !c.archived)
    .sort((a, b) => a.position - b.position);
}
