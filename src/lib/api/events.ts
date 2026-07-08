import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import type { Event, CreateEventInput, UpdateEventInput } from '@/types/event.types';

export async function getEventsByRange(startISO: string, endISO: string): Promise<Event[]> {
  const db = await getDb();
  return db.select<Event[]>(
    'SELECT * FROM events WHERE start_at < $2 AND end_at > $1 ORDER BY start_at ASC',
    [startISO, endISO]
  );
}

export async function getEventsByProject(projectId: string): Promise<Event[]> {
  const db = await getDb();
  return db.select<Event[]>(
    'SELECT * FROM events WHERE project_id = $1 ORDER BY start_at ASC',
    [projectId]
  );
}

export async function createEvent(input: CreateEventInput): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.execute(
    'INSERT INTO events (id, project_id, title, start_at, end_at) VALUES ($1, $2, $3, $4, $5)',
    [id, input.project_id, input.title, input.start_at, input.end_at]
  );
  return id;
}

export async function updateEvent(id: string, input: UpdateEventInput): Promise<void> {
  const entries = Object.entries(input).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;

  const db = await getDb();
  const setClause = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(id);

  await db.execute(`UPDATE events SET ${setClause} WHERE id = $${entries.length + 1}`, values);
}

export async function deleteEvent(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM events WHERE id = $1', [id]);
}
