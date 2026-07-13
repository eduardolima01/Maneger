import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';

export async function createSubtask(taskId: string, title: string): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const now = toLocalISO(new Date());

  const existing = await db.select<{ maxPos: number | null }[]>(
    'SELECT MAX(position) as maxPos FROM subtasks WHERE task_id = $1',
    [taskId]
  );
  const nextPosition = (existing[0]?.maxPos ?? -1) + 1;

  await db.execute(
    'INSERT INTO subtasks (id, task_id, title, checked, position, created_at, updated_at) VALUES ($1, $2, $3, 0, $4, $5, $5)',
    [id, taskId, title, nextPosition, now]
  );
  return id;
}

export async function updateSubtask(id: string, input: Partial<{ title: string; checked: boolean }>): Promise<void> {
  const entries: [string, unknown][] = [];
  if (input.title !== undefined) entries.push(['title', input.title]);
  if (input.checked !== undefined) entries.push(['checked', input.checked ? 1 : 0]);
  if (entries.length === 0) return;
  entries.push(['updated_at', toLocalISO(new Date())]);

  const db = await getDb();
  const setClause = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(id);
  await db.execute(`UPDATE subtasks SET ${setClause} WHERE id = $${entries.length + 1}`, values);
}

export async function reorderSubtasks(taskId: string, orderedIds: string[]): Promise<void> {
  const db = await getDb();
  // Sequencial de propósito: updates concorrentes na mesma conexão SQLite podem
  // colidir (SQLITE_BUSY) e derrubar o Promise.all inteiro sem persistir nada.
  for (let index = 0; index < orderedIds.length; index++) {
    await db.execute(
      'UPDATE subtasks SET position = $1, updated_at = $2 WHERE id = $3 AND task_id = $4',
      [index, new Date().toISOString(), orderedIds[index], taskId]
    );
  }
}

export async function deleteSubtask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM subtasks WHERE id = $1', [id]);
}
