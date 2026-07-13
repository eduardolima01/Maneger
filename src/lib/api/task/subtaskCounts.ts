import { getDb } from '@/lib/db/client';

export async function getSubtaskCountsByProject(projectId: string): Promise<Record<string, { total: number; done: number }>> {
  const db = await getDb();
  const rows = await db.select<{ task_id: string; total: number; done: number }[]>(
    `SELECT s.task_id as task_id, COUNT(*) as total, SUM(CASE WHEN s.checked = 1 THEN 1 ELSE 0 END) as done
     FROM subtasks s
     JOIN tasks t ON t.id = s.task_id
     WHERE t.project_id = $1
     GROUP BY s.task_id`,
    [projectId]
  );
  return Object.fromEntries(rows.map((r) => [r.task_id, { total: r.total, done: r.done }]));
}
