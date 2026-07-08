import { getDb } from '../db/client';
import { generateId } from '../utils/uuid';
import type { Note, CreateNoteInput, UpdateNoteInput } from '../../types/note.types';

export async function getNotesByProject(projectId: string): Promise<Note[]> {
  const db = await getDb();
  return db.select<Note[]>('SELECT * FROM notes WHERE project_id = $1 ORDER BY updated_at DESC', [projectId]);
}

export async function createNote(input: CreateNoteInput): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  await db.execute(
    'INSERT INTO notes (id, project_id, title, content, updated_at) VALUES ($1, $2, $3, $4, $5)',
    [id, input.project_id, input.title ?? 'Sem título', input.content ?? '', now]
  );
  return id;
}

export async function updateNote(id: string, input: UpdateNoteInput): Promise<void> {
  const entries = Object.entries(input).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;

  const db = await getDb();
  const setClause = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  const now = new Date().toISOString();
  values.push(now, id);

  await db.execute(
    `UPDATE notes SET ${setClause}, updated_at = $${entries.length + 1} WHERE id = $${entries.length + 2}`,
    values
  );
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM notes WHERE id = $1', [id]);
}
