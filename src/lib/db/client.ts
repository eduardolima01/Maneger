import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    const dbUrl = await invoke<string>('get_db_url');
    dbInstance = await Database.load(dbUrl);
  }
  return dbInstance;
}
