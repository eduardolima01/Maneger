import { loadKanbanData, saveKanbanData } from '@/Kanban/api/kanbanDataStore';
import { generateId } from '@/lib/utils/uuid';
import type { KanbanChecklistItem, ChecklistProgress } from '@/types/kanban.types';

/**
 * Mantém o pai coerente com os filhos: sobe a cadeia a partir de `fromParentId` e deixa cada ancestral marcado
 * se, e somente se, TODOS os filhos diretos dele estão marcados. Ancestral sem filhos não é mexido (fica com o que
 * o usuário marcou). Opera em memória, sobre o `data` que o chamador vai salvar — não faz load/save próprio.
 */
function syncAncestorsChecked(items: KanbanChecklistItem[], fromParentId: string | null): void {
  const visited = new Set<string>(); // defesa contra ciclo nos dados
  let parentId = fromParentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const currentId: string = parentId;
    const parent = items.find((i) => i.id === currentId);
    if (!parent) return;
    const children = items.filter((i) => i.parentItemId === currentId);
    if (children.length === 0) return;
    parent.checked = children.every((c) => c.checked);
    parentId = parent.parentItemId ?? null;
  }
}

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
  syncAncestorsChecked(data.checklistItems, parentItemId); // sub-item novo nasce desmarcado: o pai (e os acima dele) deixa de estar 'completo'
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

  if (input.checked !== undefined) syncAncestorsChecked(data.checklistItems, item.parentItemId ?? null);
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

  const removedParentId = data.checklistItems.find((i) => i.id === id)?.parentItemId ?? null;
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
  syncAncestorsChecked(data.checklistItems, removedParentId); // apagou o último sub-item pendente? o pai passa a estar completo
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

/**
 * Copia a árvore inteira de itens (qualquer profundidade) de um card pra outro, refazendo os
 * `parentItemId` pros ids NOVOS — senão os filhos da cópia continuariam apontando pros itens do original.
 * Antes copiava só 2 níveis (raiz + filhos); netos e abaixo eram perdidos na duplicação.
 */
export async function duplicateChecklist(sourceCardId: string, targetCardId: string): Promise<void> {
  const items = await getItemsByCard(sourceCardId); // já vem ordenado por position

  const childrenByParent = new Map<string | null, KanbanChecklistItem[]>();
  for (const item of items) {
    const key = item.parentItemId ?? null;
    const list = childrenByParent.get(key) ?? [];
    list.push(item);
    childrenByParent.set(key, list);
  }

  async function copyLevel(sourceParentId: string | null, targetParentId: string | null): Promise<void> {
    for (const item of childrenByParent.get(sourceParentId) ?? []) {
      const newId = targetParentId
        ? await createSubItem(targetCardId, targetParentId, item.title)
        : await createItem(targetCardId, item.title);
      if (item.checked) await updateItem(newId, { checked: true });
      await copyLevel(item.id, newId);
    }
  }

  await copyLevel(null, null);
}

/**
 * Muda o pai de um item (dentro do MESMO card): `newParentId = null` vira tarefa principal, um id vira
 * sub-item dele. O item leva os próprios filhos junto. Sem `afterItemId` vai pro fim dos irmãos do destino;
 * com ele, entra logo depois desse irmão (usado no "subir um nível", pra o item ficar ao lado do antigo pai).
 * Recusa mover pra dentro de si mesmo ou de um descendente: criaria um ciclo e a árvore sumiria da tela.
 */
export async function moveItem(id: string, newParentId: string | null, afterItemId?: string): Promise<void> {
  const data = await loadKanbanData();
  const item = data.checklistItems.find((i) => i.id === id);
  if (!item) return;
  if ((item.parentItemId ?? null) === newParentId && !afterItemId) return;

  if (newParentId) {
    const newParent = data.checklistItems.find((i) => i.id === newParentId);
    if (!newParent || newParent.cardId !== item.cardId) throw new Error('Destino inválido: o novo pai precisa ser um item do mesmo card');

    // sobe a cadeia de pais do destino; se cruzar com o próprio item, o destino é um descendente dele
    const visited = new Set<string>();
    let cursor: KanbanChecklistItem | undefined = newParent;
    while (cursor) {
      if (cursor.id === id) throw new Error('Não dá pra mover um item pra dentro dele mesmo ou de um sub-item dele');
      if (visited.has(cursor.id)) break; // defesa: já existia um ciclo nos dados
      visited.add(cursor.id);
      const parentId: string | null = cursor.parentItemId;
      cursor = parentId ? data.checklistItems.find((i) => i.id === parentId) : undefined;
    }
  }

  const siblings = data.checklistItems
    .filter((i) => i.cardId === item.cardId && (i.parentItemId ?? null) === newParentId && i.id !== id)
    .sort((a, b) => a.position - b.position);

  let insertAt = siblings.length;
  if (afterItemId) {
    const afterIndex = siblings.findIndex((s) => s.id === afterItemId);
    if (afterIndex >= 0) insertAt = afterIndex + 1;
  }

  const oldParentId = item.parentItemId ?? null;
  item.parentItemId = newParentId;
  siblings.splice(insertAt, 0, item);
  siblings.forEach((s, index) => { s.position = index; });

  syncAncestorsChecked(data.checklistItems, oldParentId); // o pai de onde saiu pode ter ficado completo
  syncAncestorsChecked(data.checklistItems, newParentId); // e o de onde entrou pode ter deixado de estar

  await saveKanbanData(data);
}
