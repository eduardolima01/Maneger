import { getDb } from '../db/client';
import { generateId } from '../utils/uuid';
import type { ProjectType, CreateProjectInput, UpdateProjectInput } from '../../types/project.types';

export async function getProjects(): Promise<ProjectType[]> {
  const db = await getDb();
  return db.select<ProjectType[]>('SELECT * FROM projects ORDER BY name ASC');
}

export async function getProjectById(id: string): Promise<ProjectType | null> {
  const db = await getDb();
  const rows = await db.select<ProjectType[]>('SELECT * FROM projects WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function createProject(input: CreateProjectInput): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.execute('INSERT INTO projects (id, name) VALUES ($1, $2)', [id, input.name]);
  return id;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<void> {
  if (input.name === undefined) return;
  const db = await getDb();
  await db.execute('UPDATE projects SET name = $1 WHERE id = $2', [input.name, id]);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM projects WHERE id = $1', [id]);
}
