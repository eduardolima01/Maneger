import { getDb } from '@/lib/db/client';

export interface ModuleCounts {
  tasks: number;
  kanban: number;
  logs: number;
}

export async function getModuleCountsByProjectIds(projectIds: string[]): Promise<Record<string, ModuleCounts>> {
  const result: Record<string, ModuleCounts> = {};
  for (const id of projectIds) result[id] = { tasks: 0, kanban: 0, logs: 0 };
  if (projectIds.length === 0) return result;

  const db = await getDb();
  const placeholders = projectIds.map((_, i) => `$${i + 1}`).join(', ');

  const taskRows = await db.select<{ project_id: string; count: number }[]>(
    `SELECT project_id, COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders}) GROUP BY project_id`,
    projectIds
  );
  const kanbanRows = await db.select<{ project_id: string; count: number }[]>(
    `SELECT project_id, COUNT(*) as count FROM kanban_cards WHERE project_id IN (${placeholders}) GROUP BY project_id`,
    projectIds
  );
  const logRows = await db.select<{ project_id: string; count: number }[]>(
    `SELECT g.project_id as project_id, COUNT(*) as count FROM logs l
     JOIN log_groups g ON g.id = l.group_id
     WHERE g.project_id IN (${placeholders}) GROUP BY g.project_id`,
    projectIds
  );

  for (const r of taskRows) result[r.project_id].tasks = r.count;
  for (const r of kanbanRows) result[r.project_id].kanban = r.count;
  for (const r of logRows) result[r.project_id].logs = r.count;
  return result;
}
