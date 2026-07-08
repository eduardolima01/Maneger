import { getDb } from '../db/client';
import { generateId } from '../utils/uuid';
import type { KanbanCard, CreateKanbanCardInput, UpdateKanbanCardInput } from '../../types/kanbanCard.types';

export async function getKanbanCardsByProject(projectId: string): Promise<KanbanCard[]> {
  const db = await getDb();
  return db.select<KanbanCard[]>(
    'SELECT * FROM kanban_cards WHERE project_id = $1 ORDER BY position ASC, id ASC',
    [projectId]
  );
}

export async function createKanbanCard(input: CreateKanbanCardInput): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.execute(
    'INSERT INTO kanban_cards (id, project_id, title, status) VALUES ($1, $2, $3, $4)',
    [id, input.project_id, input.title, input.status ?? 'todo']
  );
  return id;
}

export async function updateKanbanCard(id: string, input: UpdateKanbanCardInput): Promise<void> {
  const entries = Object.entries(input).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;

  const db = await getDb();
  const setClause = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(id);

  await db.execute(`UPDATE kanban_cards SET ${setClause} WHERE id = $${entries.length + 1}`, values);
}

export async function deleteKanbanCard(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM kanban_cards WHERE id = $1', [id]);
}
