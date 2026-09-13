import { loadKanbanData, saveKanbanData } from '@/Kanban/api/kanbanDataStore';
import { generateId } from '@/lib/utils/uuid';
import type { KanbanColumn, CreateKanbanColumnInput, UpdateKanbanColumnInput } from '@/types/kanban.types';

export async function getColumnsByKanban(kanbanId: string): Promise<KanbanColumn[]> {
  const data = await loadKanbanData();
  return data.columns
    .filter((c) => c.kanbanId === kanbanId)
    .sort((a, b) => a.position - b.position);
}

export async function createColumn(input: CreateKanbanColumnInput): Promise<string> {
  const data = await loadKanbanData();
  const id = generateId();

  const siblings = data.columns.filter((c) => c.kanbanId === input.kanbanId);
  const nextPosition = siblings.length > 0 ? Math.max(...siblings.map((c) => c.position)) + 1 : 0;

  data.columns.push({
    id,
    kanbanId: input.kanbanId,
    name: input.name,
    color: input.color ?? null,
    icon: input.icon ?? null,
    wipLimit: input.wipLimit ?? null,
    visible: true,
    // nunca existiu de verdade no schema SQL (a tabela não tem essa coluna) — sempre foi false;
    // o estado real de "colapsada" vive em Kanban.viewPrefs.collapsedColumnIds.
    collapsed: false,
    position: nextPosition,
  });

  await saveKanbanData(data);
  return id;
}

export async function updateColumn(id: string, input: UpdateKanbanColumnInput): Promise<void> {
  const data = await loadKanbanData();
  const column = data.columns.find((c) => c.id === id);
  if (!column) return;

  let changed = false;
  if (input.name !== undefined) { column.name = input.name; changed = true; }
  if (input.color !== undefined) { column.color = input.color; changed = true; }
  if (input.icon !== undefined) { column.icon = input.icon; changed = true; }
  if (input.wipLimit !== undefined) { column.wipLimit = input.wipLimit; changed = true; }
  if (input.visible !== undefined) { column.visible = input.visible; changed = true; }
  if (!changed) return;

  await saveKanbanData(data);
}

export async function reorderColumns(kanbanId: string, orderedIds: string[]): Promise<void> {
  const data = await loadKanbanData();
  orderedIds.forEach((id, index) => {
    const column = data.columns.find((c) => c.id === id && c.kanbanId === kanbanId);
    if (column) column.position = index;
  });
  await saveKanbanData(data);
}

/** Cascade manual (antes era ON DELETE CASCADE). */
export async function deleteColumn(id: string): Promise<void> {
  const data = await loadKanbanData();

  const groupIds = new Set(data.cardGroups.filter((g) => g.columnId === id).map((g) => g.id));
  const cardIds = new Set(
    data.cards
      .filter((c) => c.columnId === id || (c.cardGroupId && groupIds.has(c.cardGroupId)))
      .map((c) => c.id)
  );

  data.checklistItems = data.checklistItems.filter((item) => !cardIds.has(item.cardId));
  data.cards = data.cards.filter((c) => !cardIds.has(c.id));
  data.cardGroups = data.cardGroups.filter((g) => !groupIds.has(g.id));
  data.columns = data.columns.filter((c) => c.id !== id);

  await saveKanbanData(data);
}

export async function duplicateColumn(id: string): Promise<string> {
  const data = await loadKanbanData();
  const original = data.columns.find((c) => c.id === id);
  if (!original) throw new Error('Coluna não encontrada para duplicar');
  return createColumn({
    kanbanId: original.kanbanId,
    name: `${original.name} (cópia)`,
    color: original.color,
    icon: original.icon,
    wipLimit: original.wipLimit,
  });
}
