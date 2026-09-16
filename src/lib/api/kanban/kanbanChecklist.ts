import { loadKanbanData, saveKanbanData } from '@/Kanban/api/kanbanDataStore';
import { generateId } from '@/lib/utils/uuid';
import type { KanbanChecklistItem, ChecklistProgress } from '@/types/kanban.types';

export async function getItemsByCard(cardId: string): Promise<KanbanChecklistItem[]> {
  const data = await loadKanbanData();
  return data.checklistItems
    .filter((item) => item.cardId === cardId)
    .sort((a, b) => a.position - b.position);
}

export async function createItem(cardId: string, title: string): Promise<string> {
  return createItemInternal(cardId, null, title);
}

async function createItemInternal(cardId: string, parentItemId: string | null, title: string): Promise<string> {
  const data = await loadKanbanData();
  const id = generateId();

  const siblings = parentItemId
    ? data.checklistItems.filter((item) => item.parentItemId === parentItemId)
    : data.checklistItems.filter((item) => item.cardId === cardId && !item.parentItemId);
  const nextPosition = siblings.length > 0 ? Math.max(...siblings.map((item) => item.position)) + 1 : 0;

  data.checklistItems.push({ id, cardId, parentItemId, title, checked: false, position: nextPosition });
  await saveKanbanData(data);
  return id;
}

export async function createSubItem(cardId: string, parentItemId: string, title: string): Promise<string> {
  return createItemInternal(cardId, parentItemId, title);
}

export async function updateItem(id: string, input: Partial<{ title: string; checked: boolean }>): Promise<void> {
  const data = await loadKanbanData();
  const item = data.checklistItems.find((i) => i.id === id);
  if (!item) return;

  let changed = false;
  if (input.title !== undefined) { item.title = input.title; changed = true; }
  if (input.checked !== undefined) { item.checked = input.checked; changed = true; }
  if (!changed) return;

  await saveKanbanData(data);
}

/**
 * Cascade recursivo (loop de ponto fixo): o schema SQL original tinha `parent_item_id`
 * auto-referenciado com `ON DELETE CASCADE` — em JSON não existe cascade automático, então
 * sub-itens em qualquer profundidade precisam ser encontrados na mão. É o único ponto desta
 * migração em que a versão JSON precisa de MAIS cuidado que a SQL, não menos.
 */
export async function deleteItem(id: string): Promise<void> {
  const data = await loadKanbanData();

  const idsToRemove = new Set([id]);
  let addedInLastPass = true;
  while (addedInLastPass) {
    addedInLastPass = false;
    for (const item of data.checklistItems) {
      if (item.parentItemId && idsToRemove.has(item.parentItemId) && !idsToRemove.has(item.id)) {
        idsToRemove.add(item.id);
        addedInLastPass = true;
      }
    }
  }

  data.checklistItems = data.checklistItems.filter((item) => !idsToRemove.has(item.id));
  await saveKanbanData(data);
}

export async function reorderItems(orderedIds: string[]): Promise<void> {
  const data = await loadKanbanData();
  orderedIds.forEach((id, index) => {
    const item = data.checklistItems.find((i) => i.id === id);
    if (item) item.position = index;
  });
  await saveKanbanData(data);
}

export async function getProgressByCardIds(cardIds: string[]): Promise<Record<string, ChecklistProgress>> {
  const result: Record<string, ChecklistProgress> = {};
  for (const id of cardIds) result[id] = { done: 0, total: 0 };
  if (cardIds.length === 0) return result;

  const data = await loadKanbanData();
  const cardIdSet = new Set(cardIds);
  for (const item of data.checklistItems) {
    if (!cardIdSet.has(item.cardId)) continue;
    const progress = result[item.cardId];
    progress.total++;
    if (item.checked) progress.done++;
  }
  return result;
}

export async function duplicateChecklist(sourceCardId: string, targetCardId: string): Promise<void> {
  const items = await getItemsByCard(sourceCardId);

  const roots = items.filter((i) => !i.parentItemId).sort((a, b) => a.position - b.position);
  const childrenByParent = new Map<string, KanbanChecklistItem[]>();
  for (const item of items) {
    if (!item.parentItemId) continue;
    const list = childrenByParent.get(item.parentItemId) ?? [];
    list.push(item);
    childrenByParent.set(item.parentItemId, list);
  }
  for (const list of childrenByParent.values()) list.sort((a, b) => a.position - b.position);

  for (const root of roots) {
    const newRootId = await createItem(targetCardId, root.title);
    if (root.checked) await updateItem(newRootId, { checked: true });

    for (const child of childrenByParent.get(root.id) ?? []) {
      const newChildId = await createSubItem(targetCardId, newRootId, child.title);
      if (child.checked) await updateItem(newChildId, { checked: true });
    }
  }
}
