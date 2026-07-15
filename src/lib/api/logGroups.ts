import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import type {
  LogGroup,
  CreateLogGroupInput,
  UpdateLogGroupInput
} from '@/types/log.types';

interface LogGroupRow {
  id: string;
  project_id: string;
  template_id: string;
  name: string;
  position: number;
}

function rowToGroup(row: LogGroupRow): LogGroup {
  return { id: row.id, projectId: row.project_id, templateId: row.template_id, name: row.name, position: row.position };
}

export async function getLogGroupsByProject(projectId: string): Promise<LogGroup[]> {
  const db = await getDb();
  const rows = await db.select<LogGroupRow[]>(
    'SELECT * FROM log_groups WHERE project_id = $1 ORDER BY position ASC',
    [projectId]
  );
  return rows.map(rowToGroup);
}

export async function createLogGroup(input: CreateLogGroupInput): Promise<string> {
  const db = await getDb();
  const id = generateId();

  const existing = await db.select<{ maxPos: number | null }[]>(
    'SELECT MAX(position) as maxPos FROM log_groups WHERE project_id = $1',
    [input.projectId]
  );
  const nextPosition = (existing[0]?.maxPos ?? -1) + 1;

  await db.execute(
    'INSERT INTO log_groups (id, project_id, template_id, name, position) VALUES ($1, $2, $3, $4, $5)',
    [id, input.projectId, input.templateId, input.name, nextPosition]
  );
  return id;
}

export async function updateLogGroup(id: string, input: UpdateLogGroupInput): Promise<void> {
  const entries = Object.entries(input).filter(([, v]) => v !== undefined) as [string, string][];
  if (entries.length === 0) return;
  const db = await getDb();
  const columnMap: Record<string, string> = { name: 'name', templateId: 'template_id' };
  const setClause = entries.map(([key], i) => `${columnMap[key]} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(id);
  await db.execute(`UPDATE log_groups SET ${setClause} WHERE id = $${entries.length + 1}`, values);
}

export async function reorderLogGroups(projectId: string, orderedIds: string[]): Promise<void> {
  const db = await getDb();
  for (let index = 0; index < orderedIds.length; index++) {
    await db.execute(
      'UPDATE log_groups SET position = $1 WHERE id = $2 AND project_id = $3',
      [index, orderedIds[index], projectId]
    );
  }
}

export async function deleteLogGroup(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM log_groups WHERE id = $1', [id]);
}
