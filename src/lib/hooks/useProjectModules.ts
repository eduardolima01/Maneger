import { useState, useEffect, useCallback } from 'react';
import * as modulesApi from '../api/modules';
import type { ModuleKey } from '../../types/module.types';
import type { ModuleStatus } from '../api/modules';

export function useProjectModules(projectId: string) {
  const [modules, setModules] = useState<ModuleStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const data = await modulesApi.getProjectModules(projectId);
    setModules(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const toggle = useCallback(
    async (moduleKey: ModuleKey, enabled: boolean) => {
      setModules((prev) => (prev ? { ...prev, [moduleKey]: enabled } : prev));
      await modulesApi.setModuleEnabled(projectId, moduleKey, enabled);
    },
    [projectId]
  );

  return { modules, loading, toggle, reload };
}

