import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import type {
  Task,
  TaskType,
  CreateTaskInput,
  UpdateTaskInput
} from '@/types/task/task.types';
import type { Subtask } from '@/types/task/subtask.types';

interface TaskRow {
  id: string;
  project_id: string;
  group_id: string | null;
  type: TaskType;
  title: string;
  description: string | null;
  payload: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface SubtaskRow {
  id: string;
  task_id: string;
  title: string;
  checked: number;
  position: number;
  created_at: string;
  updated_at: string;
}

function rowToSubtask(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    checked: !!row.checked,
    order: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToTask(row: TaskRow, subtasks: Subtask[]): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    groupId: row.group_id,
    type: row.type,
    title: row.title,
    description: row.description ?? undefined,
    payload: JSON.parse(row.payload),
    subtasks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as Task;
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  const db = await getDb();
  const taskRows = await db.select<TaskRow[]>('SELECT * FROM tasks WHERE project_id = $1 ORDER BY position ASC', [projectId]);
  if (taskRows.length === 0) return [];

  const taskIds = taskRows.map((t) => t.id);
  const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(', ');
  const subtaskRows = await db.select<SubtaskRow[]>(
    `SELECT * FROM subtasks WHERE task_id IN (${placeholders}) ORDER BY position ASC`,
    taskIds
  );

  const subtasksByTask = new Map<string, Subtask[]>();
  for (const row of subtaskRows) {
    const list = subtasksByTask.get(row.task_id) ?? [];
    list.push(rowToSubtask(row));
    subtasksByTask.set(row.task_id, list);
  }

  return taskRows.map((row) => rowToTask(row, subtasksByTask.get(row.id) ?? []));
}

export async function createTask(projectId: string, input: CreateTaskInput): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const now = toLocalISO(new Date());

  const existing = await db.select<{ maxPos: number | null }[]>(
    'SELECT MAX(position) as maxPos FROM tasks WHERE project_id = $1',
    [projectId]
  );
  const nextPosition = (existing[0]?.maxPos ?? -1) + 1;

  await db.execute(
    'INSERT INTO tasks (id, project_id, group_id, type, title, description, payload, position, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)',
    [id, projectId, input.groupId, input.type, input.title, input.description ?? null, JSON.stringify(input.payload), nextPosition, now]
  );
  return id;
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<void> {
  const entries: [string, unknown][] = [];
  if (input.title !== undefined) entries.push(['title', input.title]);
  if (input.description !== undefined) entries.push(['description', input.description]);
  if (input.groupId !== undefined) entries.push(['group_id', input.groupId]);
  if (input.payload !== undefined) entries.push(['payload', JSON.stringify(input.payload)]);
  if (entries.length === 0) return;
  entries.push(['updated_at', toLocalISO(new Date())]);

  const db = await getDb();
  const setClause = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(id);
  await db.execute(`UPDATE tasks SET ${setClause} WHERE id = $${entries.length + 1}`, values);
}

export async function reorderTasks(orderedIds: string[]): Promise<void> {
  const db = await getDb();
  for (let index = 0; index < orderedIds.length; index++) {
    await db.execute('UPDATE tasks SET position = $1 WHERE id = $2', [index, orderedIds[index]]);
  }
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM tasks WHERE id = $1', [id]);
}
