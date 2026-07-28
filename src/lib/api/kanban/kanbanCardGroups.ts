import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import type { KanbanCardGroup } from '@/types/kanban.types';

interface GroupRow {
  id: string;
  kanban_id: string;
  column_id: string;
  name: string;
  position: number;
}

function rowToGroup(row: GroupRow): KanbanCardGroup {
  return { id: row.id, kanbanId: row.kanban_id, columnId: row.column_id, name: row.name, position: row.position };
}

export async function getGroupsByKanban(kanbanId: string): Promise<KanbanCardGroup[]> {
  const db = await getDb();
  const rows = await db.select<GroupRow[]>('SELECT * FROM kanban_card_groups WHERE kanban_id = $1 ORDER BY position ASC', [kanbanId]);
  return rows.map(rowToGroup);
}

export async function createGroup(kanbanId: string, columnId: string, name: string): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const existing = await db.select<{ maxPos: number | null }[]>(
    'SELECT MAX(position) as maxPos FROM kanban_card_groups WHERE column_id = $1',
    [columnId]
  );
  const nextPosition = (existing[0]?.maxPos ?? -1) + 1;
  await db.execute('INSERT INTO kanban_card_groups (id, kanban_id, column_id, name, position) VALUES ($1, $2, $3, $4, $5)', [id, kanbanId, columnId, name, nextPosition]);
  return id;
}

export async function renameGroup(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE kanban_card_groups SET name = $1 WHERE id = $2', [name, id]);
}

/** Move o grupo (com todos os cards dele, que não mudam de group_id) pra outra coluna. */
export async function moveGroupToColumn(groupId: string, targetColumnId: string, orderedGroupAndCardIdsInColumn: string[]): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE kanban_card_groups SET column_id = $1 WHERE id = $2', [targetColumnId, groupId]);
  for (let index = 0; index < orderedGroupAndCardIdsInColumn.length; index++) {
    await db.execute('UPDATE kanban_card_groups SET position = $1 WHERE id = $2', [index, orderedGroupAndCardIdsInColumn[index]]);
  }
}

export async function reorderGroupPosition(orderedGroupIds: string[]): Promise<void> {
  const db = await getDb();
  for (let index = 0; index < orderedGroupIds.length; index++) {
    await db.execute('UPDATE kanban_card_groups SET position = $1 WHERE id = $2', [index, orderedGroupIds[index]]);
  }
}

/** Exclui o grupo SEM apagar os cards — eles voltam soltos pra coluna do grupo. */
export async function deleteGroupAndUngroupCards(id: string, kanbanId: string, columnId: string): Promise<void> {
  const db = await getDb();
  const existing = await db.select<{ maxPos: number | null }[]>(
    'SELECT MAX(position) as maxPos FROM kanban_cards WHERE column_id = $1',
    [columnId]
  );
  let nextPosition = (existing[0]?.maxPos ?? -1) + 1;

  const orphanCards = await db.select<{ id: string }[]>('SELECT id FROM kanban_cards WHERE card_group_id = $1', [id]);
  for (const c of orphanCards) {
    await db.execute(
      'UPDATE kanban_cards SET card_group_id = NULL, kanban_id = $1, column_id = $2, position = $3 WHERE id = $4',
      [kanbanId, columnId, nextPosition++, c.id]
    );
  }

  await db.execute('DELETE FROM kanban_card_groups WHERE id = $1', [id]);
}
