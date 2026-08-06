import { loadData, saveData } from '../api/modifications';

export interface ModApi {
  projectId: string;
  projectName: string;
  storage: {
    get: () => Promise<Record<string, unknown>>;
    set: (data: Record<string, unknown>) => Promise<void>;
  };
}

export function buildModApi(projectId: string, projectName: string, modKey: string): ModApi {
  return {
    projectId,
    projectName,
    storage: {
      get: () => loadData(projectId, modKey),
      set: (data) => saveData(projectId, modKey, data),
    },
  };
}
