import { ProjectType } from '@/types/project.types';
import { getDb } from '../db/client';

export async function listProjects(): Promise<ProjectType[]> {
  const db = await getDb();
  return db.select<ProjectType[]>('SELECT * FROM projects ORDER BY id DESC');
}

export async function getProjectById(id: number): Promise<ProjectType | null> {
  const db = await getDb();
  const result = await db.select<ProjectType[]>(
    'SELECT * FROM projects WHERE id = $1',
    [id]
  );
  return result[0] ?? null;
}

export async function createProject(name: string): Promise<void> {
  const db = await getDb();
  await db.execute('INSERT INTO projects (name) VALUES ($1)', [name]);
}

export async function deleteProject(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM projects WHERE id = $1', [id]);
}
