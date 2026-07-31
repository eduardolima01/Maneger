import { getChatDb } from '../database/client';

export async function getSetting(key: string): Promise<string | null> {
  const db = await getChatDb();
  const rows = await db.select<{ value: string }[]>('SELECT value FROM chat_settings WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getChatDb();
  await db.execute(
    `INSERT INTO chat_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}
