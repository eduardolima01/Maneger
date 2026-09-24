import { loadKanbanData, saveKanbanData } from '@/Kanban/api/kanbanDataStore';
import { deleteCard } from './kanbanCards';
import { generateId } from '@/lib/utils/uuid';
import type { KanbanCardGroup, ParentCardGroup, UpdateKanbanCardGroupInput } from '@/types/kanban.types';

export async function getGroupsByKanban(kanbanId: string): Promise<KanbanCardGroup[]> {
  const data = await loadKanbanData();
  return data.cardGroups
    .filter((g) => g.kanbanId === kanbanId)
    .sort((a, b) => a.position - b.position);
}

export async function createGroup(kanbanId: string, columnId: string, name: string, parentGroupId: string | null = null,): Promise<string> {
  const data = await loadKanbanData();
  const id = generateId();

  const siblings = data.cardGroups.filter((g) => g.parentGroupId === parentGroupId && g.columnId === columnId);
  const nextPosition = siblings.length > 0 ? Math.max(...siblings.map((g) => g.position)) + 1 : 0;

  data.cardGroups.push({
    id, kanbanId, columnId, name, position: nextPosition, parentGroupId,
    coverPath: null, emoji: null, description: null, backgroundColor: null,
    labels: [],
  });
  await saveKanbanData(data);
  return id;
}

export async function createSubgroup(parentGroupId: string, name: string): Promise<string> {
  const data = await loadKanbanData();
  const parent = data.cardGroups.find((g) => g.id === parentGroupId);
  if (!parent) throw new Error('Grupo-pai não encontrado para criar subgrupo');
  return createGroup(parent.kanbanId, parent.columnId, name, parentGroupId);
}

export async function renameGroup(id: string, name: string): Promise<void> {
  const data = await loadKanbanData();
  const group = data.cardGroups.find((g) => g.id === id);
  if (!group) return;
  group.name = name;
  await saveKanbanData(data);
}

/**
 * Atualiza capa, emoji, descrição e/ou cor de fundo do grupo/subgrupo.
 * O nome continua exclusivo de `renameGroup` — não faz parte deste input.
 */
export async function updateGroupAppearance(id: string, input: UpdateKanbanCardGroupInput): Promise<void> {
  const data = await loadKanbanData();
  const group = data.cardGroups.find((g) => g.id === id);
  if (!group) return;
  Object.assign(group, input);
  await saveKanbanData(data);
}

/** Todos os ids de subgrupos (recursivo, qualquer profundidade) de um grupo. */
function collectDescendantGroupIds(rootId: string, allGroups: KanbanCardGroup[]): string[] {
  const result: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const children = allGroups.filter((g) => g.parentGroupId === currentId);
    for (const child of children) {
      result.push(child.id);
      stack.push(child.id);
    }
  }
  return result;
}

/**
 * Move o grupo (com todos os cards dele, que não mudam de group_id) pra outra coluna.
 * `orderedGroupAndCardIdsInColumn` é uma lista mista de ids de grupo E de card na mesma
 * coluna (mesmo comportamento do original: só os ids que batem com um grupo de verdade
 * têm a posição atualizada aqui; ids de card na lista são ignorados por esta função).
 * Subgrupos do grupo movido acompanham a coluna nova (denormalização mantida em dia).
 */
export async function moveGroupToColumn(groupId: string, targetColumnId: string, orderedGroupAndCardIdsInColumn: string[]): Promise<void> {
  const data = await loadKanbanData();
  const group = data.cardGroups.find((g) => g.id === groupId);
  if (group) {
    group.columnId = targetColumnId;
    for (const descendantId of collectDescendantGroupIds(groupId, data.cardGroups)) {
      const descendant = data.cardGroups.find((g) => g.id === descendantId);
      if (descendant) descendant.columnId = targetColumnId;
    }
  }

  orderedGroupAndCardIdsInColumn.forEach((id, index) => {
    const g = data.cardGroups.find((g) => g.id === id);
    if (g) g.position = index;
  });

  await saveKanbanData(data);
}

/** Reordena um conjunto de grupos irmãos (top-level de uma coluna, ou subgrupos de um mesmo pai). */
export async function reorderGroupPosition(orderedGroupIds: string[]): Promise<void> {
  const data = await loadKanbanData();
  orderedGroupIds.forEach((id, index) => {
    const g = data.cardGroups.find((g) => g.id === id);
    if (g) g.position = index;
  });
  await saveKanbanData(data);
}

/**
 * Exclui o grupo SEM apagar os cards — eles voltam soltos pra coluna do grupo.
 * Recursivo: se o grupo tiver subgrupos, todos os descendentes são excluídos também
 * e os cards de TODOS eles (grupo raiz + subgrupos, qualquer profundidade) voltam soltos
 * pra coluna. Nenhum card é apagado em nenhum nível.
 */
export async function deleteGroupAndUngroupCards(id: string, kanbanId: string, columnId: string): Promise<void> {
  const data = await loadKanbanData();

  const groupIdsToRemove = [id, ...collectDescendantGroupIds(id, data.cardGroups)];
  const groupIdSet = new Set(groupIdsToRemove);

  const siblings = data.cards.filter((c) => c.columnId === columnId);
  let nextPosition = siblings.length > 0 ? Math.max(...siblings.map((c) => c.position)) + 1 : 0;

  for (const card of data.cards) {
    if (card.cardGroupId && groupIdSet.has(card.cardGroupId)) {
      card.cardGroupId = null;
      card.kanbanId = kanbanId;
      card.columnId = columnId;
      card.position = nextPosition++;
    }
  }

  data.cardGroups = data.cardGroups.filter((g) => !groupIdSet.has(g.id));

  await saveKanbanData(data);
}

/**
 * Exclui o grupo E todos os cards dentro dele — recursivo: subgrupos (qualquer
 * profundidade) e os cards de cada um também são apagados.
 *
 * Cada card é apagado via `deleteCard` de kanbanCards.ts, pra herdar o cascade
 * que já existe lá (checklist, pasta de arquivos etc.) em vez de duplicar lógica.
 * As exclusões são SEQUENCIAIS de propósito: `deleteCard` faz load/save do mesmo
 * blob JSON, então rodar em paralelo daria condição de corrida (última escrita vence).
 * Os grupos só são removidos no fim, relendo o blob, porque `deleteCard` já salvou
 * mudanças no meio do caminho e o `data` original estaria desatualizado.
 */
export async function deleteGroupAndCards(id: string): Promise<void> {
  const data = await loadKanbanData();
  if (!data.cardGroups.some((g) => g.id === id)) return;

  const groupIdSet = new Set([id, ...collectDescendantGroupIds(id, data.cardGroups)]);
  const cardIds = data.cards
    .filter((c) => c.cardGroupId && groupIdSet.has(c.cardGroupId))
    .map((c) => c.id);

  for (const cardId of cardIds) {
    await deleteCard(cardId);
  }

  const fresh = await loadKanbanData();
  fresh.cardGroups = fresh.cardGroups.filter((g) => !groupIdSet.has(g.id));
  await saveKanbanData(fresh);
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
