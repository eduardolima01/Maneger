import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import type { ProjectType, CreateProjectInput, UpdateProjectInput } from '@/types/project.types';

export async function getAllProjects(): Promise<ProjectType[]> {
  const db = await getDb();
  return db.select<ProjectType[]>('SELECT * FROM projects WHERE archived = 0 ORDER BY name ASC');
}

export async function getArchivedProjects(): Promise<ProjectType[]> {
  const db = await getDb();
  return db.select<ProjectType[]>('SELECT * FROM projects WHERE archived = 1 ORDER BY name ASC');
}

export async function setProjectArchived(id: string, archived: boolean): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE projects SET archived = $1 WHERE id = $2', [archived ? 1 : 0, id]);
}

export async function getProjectCovers(): Promise<Record<string, string | null>> {
  const db = await getDb();
  const rows = await db.select<{ id: string; cover_path: string | null }[]>('SELECT id, cover_path FROM projects');
  return Object.fromEntries(rows.map((r) => [r.id, r.cover_path]));
}

export async function getProjectById(id: string): Promise<ProjectType | null> {
  const db = await getDb();
  const rows = await db.select<ProjectType[]>('SELECT * FROM projects WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function getProjectColors(): Promise<Record<string, string | null>> {
  const db = await getDb();
  const rows = await db.select<{ id: string; color: string | null }[]>('SELECT id, color FROM projects');
  return Object.fromEntries(rows.map((r) => [r.id, r.color]));
}

export async function createProject(input: CreateProjectInput): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.execute(
    'INSERT INTO projects (id, name, color) VALUES ($1, $2, $3)',
    [id, input.name, input.color ?? null]
  );
  return id;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<void> {
  const entries = Object.entries(input).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;

  const db = await getDb();
  const setClause = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(id);

  await db.execute(`UPDATE projects SET ${setClause} WHERE id = $${entries.length + 1}`, values);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM projects WHERE id = $1', [id]);
}

