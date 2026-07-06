import { TaskType } from '@/types/task.types';
import { getDb } from '../db/client';

export async function listTasksByProject(projectId: number): Promise<TaskType[]> {
  const db = await getDb();
  return db.select<TaskType[]>(
    'SELECT * FROM tasks WHERE project_id = $1 ORDER BY id DESC',
    [projectId]
  );
}

export async function createTask(projectId: number, title: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    'INSERT INTO tasks (project_id, title) VALUES ($1, $2)',
    [projectId, title]
  );
}

export async function toggleTask(id: number, done: number): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE tasks SET done = $1 WHERE id = $2', [done ? 0 : 1, id]);
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM tasks WHERE id = $1', [id]);
}
