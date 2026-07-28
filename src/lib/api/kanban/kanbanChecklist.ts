import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import type { KanbanChecklistItem, ChecklistProgress } from '@/types/kanban.types';

interface ItemRow {
  id: string;
  card_id: string;
  parent_item_id: string | null;
  title: string;
  checked: number;
  position: number;
}

function rowToItem(row: ItemRow): KanbanChecklistItem {
  return { id: row.id, cardId: row.card_id, parentItemId: row.parent_item_id, title: row.title, checked: !!row.checked, position: row.position };
}

export async function getItemsByCard(cardId: string): Promise<KanbanChecklistItem[]> {
  const db = await getDb();
  const rows = await db.select<ItemRow[]>('SELECT * FROM kanban_card_checklist_items WHERE card_id = $1 ORDER BY position ASC', [cardId]);
  return rows.map(rowToItem);
}


export async function createItem(cardId: string, title: string): Promise<string> {
  return createItemInternal(cardId, null, title);
}

async function createItemInternal(cardId: string, parentItemId: string | null, title: string): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const now = toLocalISO(new Date());
  const existing = await db.select<{ maxPos: number | null }[]>(
    parentItemId
      ? 'SELECT MAX(position) as maxPos FROM kanban_card_checklist_items WHERE parent_item_id = $1'
      : 'SELECT MAX(position) as maxPos FROM kanban_card_checklist_items WHERE card_id = $1 AND parent_item_id IS NULL',
    [parentItemId ?? cardId]
  );
  const nextPosition = (existing[0]?.maxPos ?? -1) + 1;
  await db.execute(
    'INSERT INTO kanban_card_checklist_items (id, card_id, parent_item_id, title, checked, position, created_at, updated_at) VALUES ($1, $2, $3, $4, 0, $5, $6, $6)',
    [id, cardId, parentItemId, title, nextPosition, now]
  );
  return id;
}

export async function createSubItem(cardId: string, parentItemId: string, title: string): Promise<string> {
  return createItemInternal(cardId, parentItemId, title);
}

export async function updateItem(id: string, input: Partial<{ title: string; checked: boolean }>): Promise<void> {
  const entries: [string, unknown][] = [];
  if (input.title !== undefined) entries.push(['title', input.title]);
  if (input.checked !== undefined) entries.push(['checked', input.checked ? 1 : 0]);
  if (entries.length === 0) return;
  entries.push(['updated_at', toLocalISO(new Date())]);

  const db = await getDb();
  const setClause = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(id);
  await db.execute(`UPDATE kanban_card_checklist_items SET ${setClause} WHERE id = $${entries.length + 1}`, values);
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM kanban_card_checklist_items WHERE id = $1', [id]);
}

export async function reorderItems(orderedIds: string[]): Promise<void> {
  const db = await getDb();
  for (let index = 0; index < orderedIds.length; index++) {
    await db.execute('UPDATE kanban_card_checklist_items SET position = $1 WHERE id = $2', [index, orderedIds[index]]);
  }
}

export async function getProgressByCardIds(cardIds: string[]): Promise<Record<string, ChecklistProgress>> {
  const result: Record<string, ChecklistProgress> = {};
  for (const id of cardIds) result[id] = { done: 0, total: 0 };
  if (cardIds.length === 0) return result;

  const db = await getDb();
  const placeholders = cardIds.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await db.select<{ card_id: string; total: number; done: number }[]>(
    `SELECT card_id, COUNT(*) as total, SUM(CASE WHEN checked = 1 THEN 1 ELSE 0 END) as done
     FROM kanban_card_checklist_items WHERE card_id IN (${placeholders}) GROUP BY card_id`,
    cardIds
  );
  for (const r of rows) result[r.card_id] = { done: r.done, total: r.total };
  return result;
}
