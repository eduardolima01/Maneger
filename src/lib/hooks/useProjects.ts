import { useState, useEffect, useCallback } from 'react';
import { getDb } from '../db/client';
import { ProjectType } from "../../types/project.types.ts";

// import { invoke } from '@tauri-apps/api/core';
// import Database from '@tauri-apps/plugin-sql';
//
// const dbUrl = await invoke<string>('get_db_url');
// const db = await Database.load(dbUrl);

export function useProjects() {
  const [projects, setprojects] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDb();
      const result = await db.select<ProjectType[]>('SELECT * FROM projects ORDER BY id DESC');
      setprojects(result);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = async (name: string) => {
    const db = await getDb();
    await db.execute('INSERT INTO projects (name) VALUES ($1)', [name]);
    await refresh();
  };

  const remove = async (id: number) => {
    const db = await getDb();
    await db.execute('DELETE FROM projects WHERE id = $1', [id]);
    await refresh();
  };

  return { projects, loading, error, add, remove };
}

