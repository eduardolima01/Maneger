import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import type { KanbanColumn, CreateKanbanColumnInput, UpdateKanbanColumnInput } from '@/types/kanban.types';

interface KanbanColumnRow {
  id: string;
  kanban_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  wip_limit: number | null;
  visible: number;
  position: number;
  collapsed: number;
}

function rowToColumn(row: KanbanColumnRow): KanbanColumn {
  return {
    id: row.id,
    kanbanId: row.kanban_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    wipLimit: row.wip_limit,
    collapsed: !!row.collapsed,
    visible: !!row.visible,
    position: row.position,
  };
}

export async function getColumnsByKanban(kanbanId: string): Promise<KanbanColumn[]> {
  const db = await getDb();
  const rows = await db.select<KanbanColumnRow[]>('SELECT * FROM kanban_columns WHERE kanban_id = $1 ORDER BY position ASC', [kanbanId]);
  return rows.map(rowToColumn);
}

export async function createColumn(input: CreateKanbanColumnInput): Promise<string> {
  const db = await getDb();
  const id = generateId();

  const existing = await db.select<{ maxPos: number | null }[]>(
    'SELECT MAX(position) as maxPos FROM kanban_columns WHERE kanban_id = $1',
    [input.kanbanId]
  );
  const nextPosition = (existing[0]?.maxPos ?? -1) + 1;

  await db.execute(
    'INSERT INTO kanban_columns (id, kanban_id, name, color, icon, wip_limit, position) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, input.kanbanId, input.name, input.color ?? null, input.icon ?? null, input.wipLimit ?? null, nextPosition]
  );
  return id;
}

export async function updateColumn(id: string, input: UpdateKanbanColumnInput): Promise<void> {
  const entries: [string, unknown][] = [];
  if (input.name !== undefined) entries.push(['name', input.name]);
  if (input.color !== undefined) entries.push(['color', input.color]);
  if (input.icon !== undefined) entries.push(['icon', input.icon]);
  if (input.wipLimit !== undefined) entries.push(['wip_limit', input.wipLimit]);
  if (input.visible !== undefined) entries.push(['visible', input.visible ? 1 : 0]);
  if (entries.length === 0) return;

  const db = await getDb();
  const setClause = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(id);
  await db.execute(`UPDATE kanban_columns SET ${setClause} WHERE id = $${entries.length + 1}`, values);
}

export async function reorderColumns(kanbanId: string, orderedIds: string[]): Promise<void> {
  const db = await getDb();
  for (let index = 0; index < orderedIds.length; index++) {
    await db.execute('UPDATE kanban_columns SET position = $1 WHERE id = $2 AND kanban_id = $3', [index, orderedIds[index], kanbanId]);
  }
}

export async function deleteColumn(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM kanban_columns WHERE id = $1', [id]);
}

export async function duplicateColumn(id: string): Promise<string> {
  const db = await getDb();
  const rows = await db.select<KanbanColumnRow[]>('SELECT * FROM kanban_columns WHERE id = $1', [id]);
  const original = rows[0];
  if (!original) throw new Error('Coluna não encontrada para duplicar');
  return createColumn({
    kanbanId: original.kanban_id,
    name: `${original.name} (cópia)`,
    color: original.color,
    icon: original.icon,
    wipLimit: original.wip_limit,
  });
}
