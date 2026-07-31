import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';

let dbInstance: Database | null = null;

export async function getChatDb(): Promise<Database> {
  if (!dbInstance) {
    const dbUrl = await invoke<string>('get_chat_db_url');
    dbInstance = await Database.load(dbUrl);
    await dbInstance.execute('PRAGMA foreign_keys = ON');
  }
  return dbInstance;
}
