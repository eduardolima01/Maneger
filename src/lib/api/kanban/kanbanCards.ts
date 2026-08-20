import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import type { KanbanCard, CreateKanbanCardInput, UpdateKanbanCardInput } from '@/types/kanban.types';

interface KanbanCardRow {
  id: string;
  kanban_id: string | null;
  column_id: string | null;
  card_group_id: string | null;
  title: string;
  description: string | null;
  cover_path: string | null;
  color: string | null;
  priority: KanbanCard['priority'];
  labels: string;
  assigned_to: string | null;
  start_date: string | null;
  due_date: string | null;
  position: number;
  archived: number;
  created_at: string;
  updated_at: string;
}

function rowToCard(row: KanbanCardRow): KanbanCard {
  return {
    id: row.id,
    kanbanId: row.kanban_id,
    columnId: row.column_id,
    cardGroupId: row.card_group_id,
    title: row.title,
    description: row.description,
    coverPath: row.cover_path,
    color: row.color,
    priority: row.priority,
    labels: JSON.parse(row.labels),
    assignedTo: row.assigned_to,
    startDate: row.start_date,
    dueDate: row.due_date,
    position: row.position,
    archived: !!row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCardsByKanban(kanbanId: string, includeArchived = false): Promise<KanbanCard[]> {
  const db = await getDb();
  const query = includeArchived
    ? `SELECT c.* FROM kanban_cards c
       LEFT JOIN kanban_card_groups g ON g.id = c.card_group_id
       WHERE c.kanban_id = $1 OR g.kanban_id = $1
       ORDER BY c.position ASC`
    : `SELECT c.* FROM kanban_cards c
       LEFT JOIN kanban_card_groups g ON g.id = c.card_group_id
       WHERE (c.kanban_id = $1 OR g.kanban_id = $1) AND c.archived = 0
       ORDER BY c.position ASC`;
  const rows = await db.select<KanbanCardRow[]>(query, [kanbanId]);
  return rows.map(rowToCard);
}

export async function getCardById(id: string): Promise<KanbanCard | null> {
  const db = await getDb();
  const rows = await db.select<KanbanCardRow[]>('SELECT * FROM kanban_cards WHERE id = $1', [id]);
  return rows[0] ? rowToCard(rows[0]) : null;
}

export async function createCard(input: CreateKanbanCardInput): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const now = toLocalISO(new Date());

  // const scopeColumn = 'column_id';
  const scopeValue = input.cardGroupId ? 'card_group_id' : 'column_id';
  const scopeId = input.cardGroupId ?? input.columnId;
  const existing = await db.select<{ maxPos: number | null }[]>(
    `SELECT MAX(position) as maxPos FROM kanban_cards WHERE ${scopeValue} = $1`,
    [scopeId]
  );
  const nextPosition = (existing[0]?.maxPos ?? -1) + 1;

  await db.execute(
    `INSERT INTO kanban_cards (id, kanban_id, column_id, card_group_id, title, description, color, priority, labels, start_date, due_date, position, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
    [
      id, input.kanbanId ?? null, input.columnId ?? null, input.cardGroupId ?? null, input.title, input.description ?? null, input.color ?? null,
      input.priority ?? null, JSON.stringify(input.labels ?? []), input.startDate ?? null, input.dueDate ?? null,
      nextPosition, now,
    ]
  );
  return id;
}

export async function updateCard(id: string, input: UpdateKanbanCardInput): Promise<void> {
  const entries: [string, unknown][] = [];
  if (input.title !== undefined) entries.push(['title', input.title]);
  if (input.description !== undefined) entries.push(['description', input.description]);
  if (input.coverPath !== undefined) entries.push(['cover_path', input.coverPath]);
  if (input.color !== undefined) entries.push(['color', input.color]);
  if (input.priority !== undefined) entries.push(['priority', input.priority]);
  if (input.labels !== undefined) entries.push(['labels', JSON.stringify(input.labels)]);
  if (input.assignedTo !== undefined) entries.push(['assigned_to', input.assignedTo]);
  if (input.startDate !== undefined) entries.push(['start_date', input.startDate]);
  if (input.dueDate !== undefined) entries.push(['due_date', input.dueDate]);
  if (input.columnId !== undefined) entries.push(['column_id', input.columnId]);
  if (input.archived !== undefined) entries.push(['archived', input.archived ? 1 : 0]);
  if (entries.length === 0) return;
  entries.push(['updated_at', toLocalISO(new Date())]);

  const db = await getDb();
  const setClause = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(id);
  await db.execute(`UPDATE kanban_cards SET ${setClause} WHERE id = $${entries.length + 1}`, values);
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM kanban_cards WHERE id = $1', [id]);
}

export async function duplicateCard(id: string): Promise<string> {
  const original = await getCardById(id);
  if (!original) throw new Error('Card não encontrado para duplicar');
  return createCard({
    kanbanId: original.kanbanId,
    columnId: original.columnId,
    cardGroupId: original.cardGroupId || "",
    title: original.title,
    description: original.description,
    color: original.color,
    priority: original.priority,
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
  const db = await getDb();
  await db.execute('UPDATE kanban_cards SET column_id = $1 WHERE id = $2', [targetColumnId, cardId]);
  for (let index = 0; index < orderedCardIdsInColumn.length; index++) {
    await db.execute('UPDATE kanban_cards SET position = $1 WHERE id = $2', [index, orderedCardIdsInColumn[index]]);
  }
}

export async function reorderWithinColumn(orderedCardIds: string[]): Promise<void> {
  const db = await getDb();
  for (let index = 0; index < orderedCardIds.length; index++) {
    await db.execute('UPDATE kanban_cards SET position = $1 WHERE id = $2', [index, orderedCardIds[index]]);
  }
}

export async function getCardCountsByKanbanIds(kanbanIds: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const id of kanbanIds) result[id] = 0;
  if (kanbanIds.length === 0) return result;

  const db = await getDb();
  const placeholders = kanbanIds.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await db.select<{ kanban_id: string; count: number }[]>(
    `SELECT kanban_id, COUNT(*) as count FROM kanban_cards WHERE kanban_id IN (${placeholders}) AND archived = 0 GROUP BY kanban_id`,
    kanbanIds
  );
  for (const r of rows) result[r.kanban_id] = r.count;
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

  const db = await getDb();
  const placeholders = kanbanIds.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await db.select<{ kanban_id: string; column_id: string; column_name: string; column_position: number; count: number }[]>(
    `SELECT c.kanban_id as kanban_id, col.id as column_id, col.name as column_name, col.position as column_position, COUNT(c.id) as count
     FROM kanban_columns col
     LEFT JOIN kanban_cards c ON c.column_id = col.id AND c.archived = 0
     WHERE col.kanban_id IN (${placeholders}) AND col.visible = 1
     GROUP BY col.id
     ORDER BY col.kanban_id ASC, col.position ASC`,
    kanbanIds
  );

  for (const r of rows) {
    if (!result[r.kanban_id]) result[r.kanban_id] = [];
    result[r.kanban_id].push({ columnId: r.column_id, columnName: r.column_name, count: r.count });
  }
  return result;
}

export async function reorderCardsInGroup(orderedCardIds: string[]): Promise<void> {
  const db = await getDb();
  for (let index = 0; index < orderedCardIds.length; index++) {
    await db.execute('UPDATE kanban_cards SET position = $1 WHERE id = $2', [index, orderedCardIds[index]]);
  }
}

export async function getCardsByGroup(groupId: string): Promise<KanbanCard[]> {
  const db = await getDb();
  const rows = await db.select<KanbanCardRow[]>(
    'SELECT * FROM kanban_cards WHERE card_group_id = $1 AND archived = 0 ORDER BY position ASC',
    [groupId]
  );
  return rows.map(rowToCard);
}

export async function moveCardIntoGroup(cardId: string, groupId: string, orderedCardIdsInGroup: string[]): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE kanban_cards SET card_group_id = $1, kanban_id = NULL, column_id = NULL WHERE id = $2', [groupId, cardId]);
  for (let index = 0; index < orderedCardIdsInGroup.length; index++) {
    await db.execute('UPDATE kanban_cards SET position = $1 WHERE id = $2', [index, orderedCardIdsInGroup[index]]);
  }
}

export async function moveCardOutOfGroup(cardId: string, kanbanId: string, columnId: string, orderedIdsInColumn: string[]): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE kanban_cards SET card_group_id = NULL, kanban_id = $1, column_id = $2 WHERE id = $3', [kanbanId, columnId, cardId]);
  for (let index = 0; index < orderedIdsInColumn.length; index++) {
    await db.execute('UPDATE kanban_cards SET position = $1 WHERE id = $2', [index, orderedIdsInColumn[index]]);
  }
}

