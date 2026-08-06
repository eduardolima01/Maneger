
export type ProjectSectionKey = 'modules' | 'subprojects' | 'modifications';

export interface ProjectSectionConfig {
  defaultSection: ProjectSectionKey;
  enabledSections: Record<ProjectSectionKey, boolean>;
}

export const SECTION_ORDER: ProjectSectionKey[] = ['modules', 'subprojects', 'modifications'];

export const SECTION_LABELS: Record<ProjectSectionKey, string> = {
  modules: 'Módulos',
  subprojects: 'Subprojetos',
  modifications: 'Modificações',
};

export function defaultProjectSectionConfig(): ProjectSectionConfig {
  return {
    defaultSection: 'modules',
    enabledSections: { modules: true, subprojects: true, modifications: true },
  };
}
