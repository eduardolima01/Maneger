import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';

export interface CardPositionRow {
  id: string;
  kanban_id: string;
  column_id: string;
  task_id: string;
  position: number;
}

export async function getPositionsByKanban(kanbanId: string): Promise<CardPositionRow[]> {
  const db = await getDb();
  return db.select<CardPositionRow[]>('SELECT * FROM kanban_card_positions WHERE kanban_id = $1 ORDER BY position ASC', [kanbanId]);
}

/** Adiciona uma task existente ao Kanban, na coluna e posição indicadas (usado ao "adicionar card" a partir de uma task já existente). */
export async function addTaskToKanban(kanbanId: string, columnId: string, taskId: string): Promise<void> {
  const db = await getDb();
  const existing = await db.select<{ maxPos: number | null }[]>(
    'SELECT MAX(position) as maxPos FROM kanban_card_positions WHERE column_id = $1',
    [columnId]
  );
  const nextPosition = (existing[0]?.maxPos ?? -1) + 1;

  await db.execute(
    `INSERT INTO kanban_card_positions (id, kanban_id, column_id, task_id, position) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (kanban_id, task_id) DO UPDATE SET column_id = excluded.column_id, position = excluded.position`,
    [generateId(), kanbanId, columnId, taskId, nextPosition]
  );
}

export async function removeTaskFromKanban(kanbanId: string, taskId: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM kanban_card_positions WHERE kanban_id = $1 AND task_id = $2', [kanbanId, taskId]);
}

/** Move um card pra outra coluna e/ou reordena os cards da coluna de destino, tudo numa passada sequencial. */
export async function moveCard(kanbanId: string, taskId: string, targetColumnId: string, orderedTaskIdsInColumn: string[]): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE kanban_card_positions SET column_id = $1 WHERE kanban_id = $2 AND task_id = $3`,
    [targetColumnId, kanbanId, taskId]
  );
  // sequencial de propósito — mesmo motivo dos outros reorders do app: evita corrida no SQLite
  for (let index = 0; index < orderedTaskIdsInColumn.length; index++) {
    await db.execute(
      'UPDATE kanban_card_positions SET position = $1 WHERE kanban_id = $2 AND task_id = $3',
      [index, kanbanId, orderedTaskIdsInColumn[index]]
    );
  }
}

export async function reorderWithinColumn(kanbanId: string, orderedTaskIds: string[]): Promise<void> {
  const db = await getDb();
  for (let index = 0; index < orderedTaskIds.length; index++) {
    await db.execute('UPDATE kanban_card_positions SET position = $1 WHERE kanban_id = $2 AND task_id = $3', [index, kanbanId, orderedTaskIds[index]]);
  }
}
