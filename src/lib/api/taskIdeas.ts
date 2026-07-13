import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import type { TaskIdea } from '@/types/taskIdea.types';
import { toLocalISO } from '@/lib/utils/date';

export async function getIdeasByProject(projectId: string): Promise<TaskIdea[]> {
  const db = await getDb();
  return db.select<TaskIdea[]>('SELECT * FROM task_ideas WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
}

export async function createIdea(projectId: string, content: string): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.execute(
    'INSERT INTO task_ideas (id, project_id, content, created_at) VALUES ($1, $2, $3, $4)',
    [id, projectId, content, toLocalISO(new Date())]
  );
  return id;
}

export async function deleteIdea(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM task_ideas WHERE id = $1', [id]);
}
