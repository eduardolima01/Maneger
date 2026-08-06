import { invoke } from '@tauri-apps/api/core';
import { ProjectSectionConfig, defaultProjectSectionConfig } from
  "../types/projectSection.types"

export async function loadProjectSectionConfig(projectId: string): Promise<ProjectSectionConfig> {
  const raw = await invoke<string>('load_project_section_config', { projectId });
  try {
    const parsed = JSON.parse(raw);
    const base = defaultProjectSectionConfig();
    return {
      defaultSection: parsed.defaultSection ?? base.defaultSection,
      enabledSections: { ...base.enabledSections, ...parsed.enabledSections },
    };
  } catch {
    return defaultProjectSectionConfig();
  }
}

export async function saveProjectSectionConfig(projectId: string, config: ProjectSectionConfig): Promise<void> {
  await invoke('save_project_section_config', { projectId, data: JSON.stringify(config, null, 2) });
}
