import { useState, useEffect, useCallback } from 'react';
import { getProjectColors } from '@/lib/api/projects';
import { getProjectColor } from '@/lib/utils/projectColor';

export function useProjectColors() {
  const [colorMap, setColorMap] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const map = await getProjectColors();
    setColorMap(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const resolveColor = useCallback(
    (projectId: string | null) => {
      if (!projectId) return getProjectColor(null);
      const stored = colorMap[projectId];
      return stored ?? getProjectColor(projectId);
    },
    [colorMap]
  );

  return { resolveColor, loading, reload };
}
