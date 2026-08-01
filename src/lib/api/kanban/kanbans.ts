import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import { defaultViewPrefs } from '@/types/kanban.types';
import type { Kanban, CreateKanbanInput, UpdateKanbanInput, KanbanViewPrefs } from '@/types/kanban.types';

export interface KanbanRow {
  id: string;
  project_id: string;
  parent_card_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  is_default: number;
  archived: number;
  position: number;
  view_prefs: string;
  created_at: string;
  updated_at: string;
}

function rowToKanban(row: KanbanRow): Kanban {
  let viewPrefs: KanbanViewPrefs;
  try {
    viewPrefs = { ...defaultViewPrefs(), ...JSON.parse(row.view_prefs) };
  } catch {
    viewPrefs = defaultViewPrefs();
  }
  return {
    id: row.id,
    projectId: row.project_id,
    parentCardId: row.parent_card_id,
    name: row.name,
    description: row.description,
    color: row.color,
    isDefault: !!row.is_default,
    archived: !!row.archived,
    position: row.position,
    viewPrefs,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getKanbansByProject(projectId: string, includeArchived = false): Promise<Kanban[]> {
  const db = await getDb();
  const query = includeArchived
    ? 'SELECT * FROM kanbans WHERE project_id = $1 ORDER BY position ASC'
    : 'SELECT * FROM kanbans WHERE project_id = $1 AND archived = 0 ORDER BY position ASC';
  const rows = await db.select<KanbanRow[]>(query, [projectId]);
  return rows.map(rowToKanban);
}

export async function getKanbanById(id: string): Promise<Kanban | null> {
  const db = await getDb();
  const rows = await db.select<KanbanRow[]>('SELECT * FROM kanbans WHERE id = $1', [id]);
  return rows[0] ? rowToKanban(rows[0]) : null;
}

const DEFAULT_COLUMN_NAMES = ['Pendências', 'Fazer', 'Fazendo', 'Feito'];

export async function createKanban(input: CreateKanbanInput): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const now = toLocalISO(new Date());

  const existing = await db.select<{ maxPos: number | null; count: number }[]>(
    'SELECT MAX(position) as maxPos, COUNT(*) as count FROM kanbans WHERE project_id = $1',
    [input.projectId]
  );
  const nextPosition = (existing[0]?.maxPos ?? -1) + 1;
  const isFirstKanban = !input.parentCardId && (existing[0]?.count ?? 0) === 0; // sub-kanban de card nunca vira "padrão do projeto"

  await db.execute(
    `INSERT INTO kanbans (id, project_id, parent_card_id, name, description, color, is_default, position, view_prefs, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
    [id, input.projectId, input.parentCardId ?? null, input.name, input.description ?? null, input.color ?? null, isFirstKanban ? 1 : 0, nextPosition, JSON.stringify(defaultViewPrefs()), now]
  );

  // colunas padrão, criadas automaticamente pra um Kanban novo não nascer vazio de estrutura
  for (let i = 0; i < DEFAULT_COLUMN_NAMES.length; i++) {
    await db.execute(
      'INSERT INTO kanban_columns (id, kanban_id, name, position) VALUES ($1, $2, $3, $4)',
      [generateId(), id, DEFAULT_COLUMN_NAMES[i], i]
    );
  }

  return id;
}

export async function updateKanban(id: string, input: UpdateKanbanInput): Promise<void> {
  const entries: [string, unknown][] = [];
  if (input.name !== undefined) entries.push(['name', input.name]);
  if (input.description !== undefined) entries.push(['description', input.description]);
  if (input.color !== undefined) entries.push(['color', input.color]);
  if (input.archived !== undefined) entries.push(['archived', input.archived ? 1 : 0]);
  if (input.viewPrefs !== undefined) entries.push(['view_prefs', JSON.stringify(input.viewPrefs)]);
  if (entries.length === 0) return;
  entries.push(['updated_at', toLocalISO(new Date())]);

  const db = await getDb();
  const setClause = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(id);
  await db.execute(`UPDATE kanbans SET ${setClause} WHERE id = $${entries.length + 1}`, values);
}

export async function setDefaultKanban(projectId: string, kanbanId: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE kanbans SET is_default = 0 WHERE project_id = $1', [projectId]);
  await db.execute('UPDATE kanbans SET is_default = 1 WHERE id = $1', [kanbanId]);
}

export async function reorderKanbans(projectId: string, orderedIds: string[]): Promise<void> {
  const db = await getDb();
  for (let index = 0; index < orderedIds.length; index++) {
    await db.execute('UPDATE kanbans SET position = $1 WHERE id = $2 AND project_id = $3', [index, orderedIds[index], projectId]);
  }
}

export async function deleteKanban(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM kanbans WHERE id = $1', [id]);
}

/** Cópia rasa da estrutura (Kanban + Colunas), SEM cards — cards ficam fora de propósito, já que o objetivo é um board vazio pronto pra popular. */
export async function duplicateKanban(id: string): Promise<string> {
  const db = await getDb();
  const original = await getKanbanById(id);
  if (!original) throw new Error('Kanban não encontrado para duplicar');

  const newId = await createKanban({
    projectId: original.projectId,
    name: `${original.name} (cópia)`,
    description: original.description,
    color: original.color,
  });

  // remove as colunas-padrão criadas automaticamente e recria a partir das colunas reais do original
  const originalColumns = await db.select<{ id: string; name: string; color: string | null; icon: string | null; wip_limit: number | null; visible: number; position: number }[]>(
    'SELECT * FROM kanban_columns WHERE kanban_id = $1 ORDER BY position ASC',
    [id]
  );
  await db.execute('DELETE FROM kanban_columns WHERE kanban_id = $1', [newId]);
  for (const col of originalColumns) {
    await db.execute(
      'INSERT INTO kanban_columns (id, kanban_id, name, color, icon, wip_limit, visible, position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [generateId(), newId, col.name, col.color, col.icon, col.wip_limit, col.visible, col.position]
    );
  }

  return newId;
}

interface KanbanWithProject extends Kanban {
  projectName: string;
  projectColor: string | null;
  projectCoverPath: string | null;
  projectArchived: boolean;
}

interface KanbanWithProjectRow extends KanbanRow {
  project_name: string;
  project_color: string | null;
  project_cover_path: string | null;
  project_archived: number;
}

export async function getAllKanbansWithProject(): Promise<KanbanWithProject[]> {
  const db = await getDb();
  const rows = await db.select<KanbanWithProjectRow[]>(
    `SELECT k.*, p.name as project_name, p.color as project_color, p.cover_path as project_cover_path, p.archived as project_archived
     FROM kanbans k
     JOIN projects p ON p.id = k.project_id
     WHERE k.parent_card_id IS NULL
     ORDER BY p.name ASC, k.position ASC`
  );
  return rows.map((row) => ({
    ...rowToKanban(row),
    projectName: row.project_name,
    projectColor: row.project_color,
    projectCoverPath: row.project_cover_path,
    projectArchived: !!row.project_archived,
  }));
}

export async function getSubKanbanByCardId(cardId: string): Promise<Kanban | null> {
  const db = await getDb();
  const rows = await db.select<KanbanRow[]>('SELECT * FROM kanbans WHERE parent_card_id = $1 LIMIT 1', [cardId]);
  return rows[0] ? rowToKanban(rows[0]) : null;
}

export async function getCardIdsWithSubKanban(cardIds: string[]): Promise<Set<string>> {
  if (cardIds.length === 0) return new Set();
  const db = await getDb();
  const placeholders = cardIds.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await db.select<{ parent_card_id: string }[]>(
    `SELECT DISTINCT parent_card_id FROM kanbans WHERE parent_card_id IN (${placeholders})`,
    cardIds
  );
  return new Set(rows.map((r) => r.parent_card_id));
}
