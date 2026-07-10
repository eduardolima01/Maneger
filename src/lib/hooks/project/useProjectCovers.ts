import { useState, useEffect, useCallback } from 'react';
import { getProjectCovers } from '@/lib/api/projects';

export function useProjectCovers() {
  const [coverMap, setCoverMap] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const map = await getProjectCovers();
    setCoverMap(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const resolveCover = useCallback(
    (projectId: string | null) => (projectId ? coverMap[projectId] ?? null : null),
    [coverMap]
  );

  return { resolveCover, loading, reload };
}
