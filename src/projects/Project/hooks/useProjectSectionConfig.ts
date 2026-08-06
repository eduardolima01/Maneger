import { useState, useEffect, useCallback } from 'react';
import * as api from "../api/projectSectionConfig"
import { defaultProjectSectionConfig, ProjectSectionConfig, ProjectSectionKey, SECTION_ORDER } from '../types/projectSection.types';

export function useProjectSectionConfig(projectId: string) {
  const [config, setConfig] = useState<ProjectSectionConfig>(defaultProjectSectionConfig());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.loadProjectSectionConfig(projectId).then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, [projectId]);

  const persist = useCallback((next: ProjectSectionConfig) => {
    setConfig(next);
    api.saveProjectSectionConfig(projectId, next).catch(() => { });
  }, [projectId]);

  const setDefaultSection = useCallback((key: ProjectSectionKey) => {
    if (!config.enabledSections[key]) return; // não permite escolher uma aba desabilitada como padrão
    persist({ ...config, defaultSection: key });
  }, [config, persist]);

  const toggleSectionEnabled = useCallback((key: ProjectSectionKey) => {
    const nextEnabled = { ...config.enabledSections, [key]: !config.enabledSections[key] };
    const stillHasOne = SECTION_ORDER.some((k) => nextEnabled[k]);
    if (!stillHasOne) return; // nunca deixa todas desabilitadas

    let nextDefault = config.defaultSection;
    if (!nextEnabled[nextDefault]) {
      nextDefault = SECTION_ORDER.find((k) => nextEnabled[k])!; // se desabilitou a padrão, escolhe a próxima disponível
    }

    persist({ defaultSection: nextDefault, enabledSections: nextEnabled });
  }, [config, persist]);

  const firstEnabledSection = SECTION_ORDER.find((k) => config.enabledSections[k]) ?? 'modules';

  return { config, loading, setDefaultSection, toggleSectionEnabled, firstEnabledSection };
}
