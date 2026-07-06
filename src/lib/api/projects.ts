import { ProjectType } from '@/types/project.types';
import { getDb } from '../db/client';

export async function listProjects(): Promise<ProjectType[]> {
  const db = await getDb();
  return db.select<ProjectType[]>('SELECT * FROM projects ORDER BY id DESC');
}

export async function createProject(name: string): Promise<void> {
  const db = await getDb();
  await db.execute('INSERT INTO projects (name) VALUES ($1)', [name]);
}
