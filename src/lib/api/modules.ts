import { getDb } from '../db/client';
import { ALL_MODULES, ModuleKey } from '../../types/module.types';

export type ModuleStatus = Record<ModuleKey, boolean>;

export async function getProjectModules(projectId: string): Promise<ModuleStatus> {
  const db = await getDb();
  const rows = await db.select<{ module_key: ModuleKey; enabled: number }[]>(
    'SELECT module_key, enabled FROM project_modules WHERE project_id = $1',
    [projectId]
  );

  const overrides = new Map(rows.map((r) => [r.module_key, r.enabled === 1]));

  const status = {} as ModuleStatus;
  for (const { key } of ALL_MODULES) {
    status[key] = overrides.has(key) ? overrides.get(key)! : true;
  }
  return status;
}

export async function setModuleEnabled(
  projectId: string,
  moduleKey: ModuleKey,
  enabled: boolean
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO project_modules (project_id, module_key, enabled)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, module_key) DO UPDATE SET enabled = excluded.enabled`,
    [projectId, moduleKey, enabled ? 1 : 0]
  );
}
