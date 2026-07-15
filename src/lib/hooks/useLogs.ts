import { useState, useEffect, useCallback, useMemo } from 'react';
import * as api from '@/lib/api/logs';
import type { Log, LogValues, LogQueryOptions } from '@/types/log.types';

const DEFAULT_PAGE_SIZE = 20;

export function useLogs(groupId: string, templateId: string) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<LogQueryOptions>({ sortDir: 'desc', page: 1, pageSize: DEFAULT_PAGE_SIZE });

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await api.getLogsByGroup(groupId);
    setLogs(data);
    setLoading(false);
  }, [groupId]);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (values: LogValues) => {
    await api.createLog({ groupId, templateId, values });
    await reload();
  }, [groupId, templateId, reload]);

  const update = useCallback(async (id: string, values: LogValues) => {
    await api.updateLog(id, { values });
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await api.deleteLog(id);
    await reload();
  }, [reload]);

  const duplicate = useCallback(async (id: string) => {
    await api.duplicateLog(id);
    await reload();
  }, [reload]);

  const filteredSorted = useMemo(() => {
    let result = logs;

    if (query.search?.trim()) {
      const term = query.search.trim().toLowerCase();
      result = result.filter((log) =>
        Object.values(log.values).some((v) => String(v ?? '').toLowerCase().includes(term))
      );
    }

    if (query.sortByFieldKey) {
      const key = query.sortByFieldKey;
      const dir = query.sortDir === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        const av = a.values[key];
        const bv = b.values[key];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    } else if (query.sortDir === 'asc') {
      result = [...result].reverse(); // já vem DESC do banco por padrão
    }

    return result;
  }, [logs, query.search, query.sortByFieldKey, query.sortDir]);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const paginated = useMemo(
    () => filteredSorted.slice((page - 1) * pageSize, page * pageSize),
    [filteredSorted, page, pageSize]
  );

  return {
    logs: paginated,
    totalCount: filteredSorted.length,
    loading,
    query,
    setQuery,
    create,
    update,
    remove,
    duplicate,
    reload,
  };
}
