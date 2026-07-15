import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import type { Log, CreateLogInput, UpdateLogInput } from '@/types/log.types';

interface LogRow {
  id: string;
  group_id: string;
  template_id: string;
  data: string;
  created_at: string;
  updated_at: string;
}

function rowToLog(row: LogRow): Log {
  return {
    id: row.id,
    groupId: row.group_id,
    templateId: row.template_id,
    values: JSON.parse(row.data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getLogsByGroup(groupId: string): Promise<Log[]> {
  const db = await getDb();
  const rows = await db.select<LogRow[]>(
    'SELECT * FROM logs WHERE group_id = $1 ORDER BY created_at DESC',
    [groupId]
  );
  return rows.map(rowToLog);
}

export async function createLog(input: CreateLogInput): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const now = toLocalISO(new Date());
  await db.execute(
    'INSERT INTO logs (id, group_id, template_id, data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5)',
    [id, input.groupId, input.templateId, JSON.stringify(input.values), now]
  );
  return id;
}

export async function updateLog(id: string, input: UpdateLogInput): Promise<void> {
  if (input.values === undefined) return;
  const db = await getDb();
  await db.execute(
    'UPDATE logs SET data = $1, updated_at = $2 WHERE id = $3',
    [JSON.stringify(input.values), toLocalISO(new Date()), id]
  );
}

export async function deleteLog(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM logs WHERE id = $1', [id]);
}

export async function duplicateLog(id: string): Promise<string> {
  const db = await getDb();
  const rows = await db.select<LogRow[]>('SELECT * FROM logs WHERE id = $1', [id]);
  const original = rows[0];
  if (!original) throw new Error('Log não encontrado para duplicar');

  const newId = generateId();
  const now = toLocalISO(new Date());
  await db.execute(
    'INSERT INTO logs (id, group_id, template_id, data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5)',
    [newId, original.group_id, original.template_id, original.data, now]
  );
  return newId;
}

