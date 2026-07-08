import { getDb } from '../db/client';
import { generateId } from '../utils/uuid';
import type { TaskType, CreateTaskInput, UpdateTaskInput } from '../../types/task.types';

export async function getTasksByProject(projectId: string): Promise<TaskType[]> {
  const db = await getDb();
  return db.select<TaskType[]>('SELECT * FROM tasks WHERE project_id = $1 ORDER BY id ASC', [projectId]);
}

export async function createTask(input: CreateTaskInput): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.execute(
    'INSERT INTO tasks (id, project_id, title, status) VALUES ($1, $2, $3, $4)',
    [id, input.project_id, input.title, input.status ?? 'todo']
  );
  return id;
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<void> {
  const entries = Object.entries(input).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;

  const db = await getDb();
  const setClause = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(id);

  await db.execute(`UPDATE tasks SET ${setClause} WHERE id = $${entries.length + 1}`, values);
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM tasks WHERE id = $1', [id]);
}
