import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import type { TaskGroup, CreateTaskGroupInput, UpdateTaskGroupInput } from '@/types/task/group.types';

interface TaskGroupRow {
  id: string;
  project_id: string;
  name: string;
}

function rowToGroup(row: TaskGroupRow): TaskGroup {
  return { id: row.id, projectId: row.project_id, name: row.name };
}

export async function getTaskGroupsByProject(projectId: string): Promise<TaskGroup[]> {
  const db = await getDb();
  const rows = await db.select<TaskGroupRow[]>('SELECT * FROM task_groups WHERE project_id = $1 ORDER BY name ASC', [projectId]);
  return rows.map(rowToGroup);
}

export async function createTaskGroup(input: CreateTaskGroupInput): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.execute('INSERT INTO task_groups (id, project_id, name) VALUES ($1, $2, $3)', [id, input.projectId, input.name]);
  return id;
}

export async function updateTaskGroup(id: string, input: UpdateTaskGroupInput): Promise<void> {
  if (!input.name) return;
  const db = await getDb();
  await db.execute('UPDATE task_groups SET name = $1 WHERE id = $2', [input.name, id]);
}

export async function deleteTaskGroup(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM task_groups WHERE id = $1', [id]);
}
