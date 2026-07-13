import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import type {
  TaskGroup,
  CreateTaskGroupInput,
  UpdateTaskGroupInput
} from '@/types/task/group.types';

interface TaskGroupRow {
  id: string;
  project_id: string;
  name: string;
  position: number;
}

function rowToGroup(row: TaskGroupRow): TaskGroup {
  return { id: row.id, projectId: row.project_id, name: row.name };
}

export async function getTaskGroupsByProject(projectId: string): Promise<TaskGroup[]> {
  const db = await getDb();
  const rows = await db.select<TaskGroupRow[]>(
    'SELECT * FROM task_groups WHERE project_id = $1 ORDER BY position ASC',
    [projectId]
  );
  return rows.map(rowToGroup);
}

export async function createTaskGroup(input: CreateTaskGroupInput): Promise<string> {
  const db = await getDb();
  const id = generateId();

  const existing = await db.select<{ maxPos: number | null }[]>(
    'SELECT MAX(position) as maxPos FROM task_groups WHERE project_id = $1',
    [input.projectId]
  );
  const nextPosition = (existing[0]?.maxPos ?? -1) + 1;

  await db.execute(
    'INSERT INTO task_groups (id, project_id, name, position) VALUES ($1, $2, $3, $4)',
    [id, input.projectId, input.name, nextPosition]
  );
  return id;
}

export async function updateTaskGroup(id: string, input: UpdateTaskGroupInput): Promise<void> {
  if (!input.name) return;
  const db = await getDb();
  await db.execute('UPDATE task_groups SET name = $1 WHERE id = $2', [input.name, id]);
}

export async function reorderTaskGroups(projectId: string, orderedIds: string[]): Promise<void> {
  const db = await getDb();
  // Sequencial de propósito — mesma razão do reorder de subtasks: updates concorrentes
  // na mesma conexão SQLite podem colidir e derrubar a persistência inteira.
  for (let index = 0; index < orderedIds.length; index++) {
    await db.execute(
      'UPDATE task_groups SET position = $1 WHERE id = $2 AND project_id = $3',
      [index, orderedIds[index], projectId]
    );
  }
}

export async function deleteTaskGroup(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM task_groups WHERE id = $1', [id]);
}
