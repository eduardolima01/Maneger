import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import type { ProjectType, CreateProjectInput, UpdateProjectInput } from '@/types/project.types';

interface ProjectRow {
  id: string;
  parent_project_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  cover_path: string | null;
  archived: number;
  position: number;
}

function rowToProject(row: ProjectRow): ProjectType {
  return {
    id: row.id,
    parentProjectId: row.parent_project_id ?? null,
    name: row.name,
    description: row.description,
    color: row.color,
    cover_path: row.cover_path,
    archived: row.archived,
    position: row.position,
  };
}

export async function getAllProjects(): Promise<ProjectType[]> {
  const db = await getDb();
  const rows = await db.select<ProjectRow[]>('SELECT * FROM projects WHERE archived = 0 ORDER BY name ASC');
  return rows.map(rowToProject);
}

export async function getArchivedProjects(): Promise<ProjectType[]> {
  const db = await getDb();
  const rows = await db.select<ProjectRow[]>('SELECT * FROM projects WHERE archived = 1 ORDER BY name ASC');
  return rows.map(rowToProject);
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
  const rows = await db.select<ProjectRow[]>('SELECT * FROM projects WHERE id = $1', [id]);
  return rows[0] ? rowToProject(rows[0]) : null;
}

export async function getProjectColors(): Promise<Record<string, string | null>> {
  const db = await getDb();
  const rows = await db.select<{ id: string; color: string | null }[]>('SELECT id, color FROM projects');
  return Object.fromEntries(rows.map((r) => [r.id, r.color]));
}

export async function createProject(input: CreateProjectInput): Promise<string> {
  const db = await getDb();
  const id = generateId();

  const parentId = input.parentProjectId ?? null;
  const posRows = parentId
    ? await db.select<{ maxPos: number | null }[]>('SELECT MAX(position) as maxPos FROM projects WHERE parent_project_id = $1', [parentId])
    : await db.select<{ maxPos: number | null }[]>('SELECT MAX(position) as maxPos FROM projects WHERE parent_project_id IS NULL', []);
  const nextPosition = (posRows[0]?.maxPos ?? -1) + 1;

  await db.execute(
    'INSERT INTO projects (id, parent_project_id, name, description, color, position) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, parentId, input.name, input.description ?? null, input.color ?? null, nextPosition]
  );
  return id;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<void> {
  const entries = Object.entries(input).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;

  const columnMap: Record<string, string> = {
    name: 'name', description: 'description', color: 'color', cover_path: 'cover_path', archived: 'archived',
    parentProjectId: 'parent_project_id',
  };
  const setClause = entries.map(([key], i) => `${columnMap[key]} = $${i + 1}`).join(', ');
  const db = await getDb();

  const values = entries.map(([, v]) => v);
  values.push(id);

  await db.execute(`UPDATE projects SET ${setClause} WHERE id = $${entries.length + 1}`, values);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM projects WHERE id = $1', [id]);
}

export async function reorderProjects(orderedIds: string[]): Promise<void> {
  const db = await getDb();
  for (let index = 0; index < orderedIds.length; index++) {
    await db.execute('UPDATE projects SET position = $1 WHERE id = $2', [index, orderedIds[index]]);
  }
}

export async function moveProject(id: string, newParentId: string | null): Promise<void> {
  const db = await getDb();
  const posRows = newParentId
    ? await db.select<{ maxPos: number | null }[]>('SELECT MAX(position) as maxPos FROM projects WHERE parent_project_id = $1', [newParentId])
    : await db.select<{ maxPos: number | null }[]>('SELECT MAX(position) as maxPos FROM projects WHERE parent_project_id IS NULL', []);
  const nextPosition = (posRows[0]?.maxPos ?? -1) + 1;
  await db.execute('UPDATE projects SET parent_project_id = $1, position = $2 WHERE id = $3', [newParentId, nextPosition, id]);
}

/** Cópia rasa: nome + " (cópia)", cor igual, capa NÃO duplicada, sem filhos, sem dados de módulos. */
export async function duplicateProject(id: string): Promise<string> {
  const original = await getProjectById(id);
  if (!original) throw new Error('Projeto não encontrado para duplicar');
  return createProject({
    name: `${original.name} (cópia)`,
    description: original.description,
    color: original.color,
    parentProjectId: original.parentProjectId,
  });
}
