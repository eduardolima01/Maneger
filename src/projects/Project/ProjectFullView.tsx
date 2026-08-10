import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { getProjectById } from '@/lib/api/projects'
import { ProjectType } from '@/types/project.types'
import Button from '@/components/layout/Button'
import { useProjectModules } from '@/lib/hooks/useProjectModules'
import ProjectSettingsModal from './ProjectSettingsModal';
import ProjectModuleTabs from './modules/ProjectModuleTabs';
import { convertFileSrc } from '@tauri-apps/api/core';
import SubprojectsSection from './SubProject/SubprojectsSection'
import ProjectBreadcrumb from '../components/ProjectBreadcrumb'
import { useTabMeta } from '@/components/layout/tabs/useTabMeta'
import ModificationsSection from './modifications/ModificationsSection'
import { ProjectSectionKey, SECTION_LABELS, SECTION_ORDER } from './types/projectSection.types'
import ProjectSectionSettingsPopover from './ProjectSectionSettingsPopover'
import { useProjectSectionConfig } from './hooks/useProjectSectionConfig'

import { useSubprojects } from '@/lib/hooks/useSubprojects';
import * as modsApi from './modifications/api/modifications';
import type { ModificationManifest } from "./modifications/types/modification.types"
import AvatarChip from './components/AvatarChip'
import { recordProjectOpened } from '@/Dashboard/recentActivity'

interface ProjectFullViewProps {
  projectId: string;
  /** Reporta título/breadcrumb pra aba ativa. Desative quando renderizar dentro de um modal (ex: Agenda), senão ele sequestra o título da aba de fora. */
  reportTabMeta?: boolean;
  /** Chamado imediatamente antes de qualquer navegação interna real (ex: clicar num subprojeto). Use pra fechar o modal que envolve este componente. */
  onInternalNavigate?: () => void;
}

function TabMetaReporter({ title, status, breadcrumb }: {
  title: string;
  status: 'loading' | 'ready' | 'not-found';
  breadcrumb?: string[];
}) {
  useTabMeta({ title, icon: '📁', status, breadcrumb });
  return null;
}

export function ProjectFullView({ projectId, reportTabMeta = true, onInternalNavigate }: ProjectFullViewProps) {
  const [project, setProject] = useState<ProjectType | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { modules, toggle: toggleModule } = useProjectModules(projectId)
  const [breadcrumbRefresh, setBreadcrumbRefresh] = useState(0)
  const { config: sectionConfig, loading: sectionConfigLoading, setDefaultSection, toggleSectionEnabled, firstEnabledSection } = useProjectSectionConfig(projectId)
  const [activeSection, setActiveSection] = useState<ProjectSectionKey | null>(null)
  const [sectionSettingsOpen, setSectionSettingsOpen] = useState(false)

  const { subprojects } = useSubprojects(projectId)
  const [modManifests, setModManifests] = useState<ModificationManifest[]>([])
  const [focusModKey, setFocusModKey] = useState<string | null>(null)
  const [focusModNonce, setFocusModNonce] = useState(0)

  useEffect(() => {
    let cancelled = false;
    modsApi.listModifications(projectId).then(async (keys) => {
      const entries = await Promise.all(keys.map((k) => modsApi.loadManifest(projectId, k)));
      if (!cancelled) setModManifests(entries.filter((m): m is ModificationManifest => !!m));
    });
    return () => { cancelled = true; };
  }, [projectId, activeSection])

  useEffect(() => {
    if (!sectionConfigLoading && activeSection === null) {
      setActiveSection(sectionConfig.enabledSections[sectionConfig.defaultSection] ? sectionConfig.defaultSection : firstEnabledSection)
    }
  }, [sectionConfigLoading, sectionConfig, firstEnabledSection, activeSection])

  useEffect(() => {
    if (activeSection && !sectionConfig.enabledSections[activeSection]) {
      setActiveSection(firstEnabledSection)
    }
  }, [activeSection, sectionConfig, firstEnabledSection])

  const getProject = async () => await
    getProjectById(projectId).then((p) => {
      setProject(p)
      setLoadingProject(false)
      if (p) recordProjectOpened({ id: p.id, name: p.name })
    })
  useEffect(() => {
    getProject()
  }, [projectId])

  if (loadingProject || !project) {
    return (
      <>
        {reportTabMeta && <TabMetaReporter title="Carregando..." status="loading" />}
        <p>Carregando projeto...</p>
      </>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: '95vw', margin: '2rem auto', padding: '0 24px' }}>
      {reportTabMeta && (
        <TabMetaReporter title={project.name} status="ready" breadcrumb={[project.name]} />
      )}

      <ProjectBreadcrumb
        projectId={projectId}
        refreshToken={breadcrumbRefresh}
      />

      {project.cover_path && (
        <img
          src={convertFileSrc(project.cover_path)}
          style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }}
        />
      )}

      <div className="flex items-center justify-between my-4">
        <div className="flex gap-2">
          <div
            className={`flex w-2 h-6`}
            style={{
              backgroundColor: project.color || '#1a73e8',
            }}
          >
          </div>
          <h1>
            {project.name}
          </h1>
        </div>
        <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
          ⚙ Configurações
        </Button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: '2px solid #e0e0e0', marginBottom: 12, position: 'relative' }}>
        {SECTION_ORDER.filter((section) => sectionConfig.enabledSections[section]).map((section) => (
          <div
            key={section}
            onClick={() => setActiveSection(section)}
            style={{
              display: 'flex', alignItems: 'center',
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeSection === section ? '2px solid #1a73e8' : '2px solid transparent',
              marginBottom: -2,
              color: activeSection === section ? '#1a73e8' : '#666',
              cursor: 'pointer',
            }}
          >
            <span>{SECTION_LABELS[section]}</span>

            {section === 'subprojects' && subprojects.length > 0 && (
              <div style={{ display: 'flex', marginLeft: 10 }}>
                {subprojects.slice(0, 6).map((sp) => (
                  <AvatarChip
                    key={sp.id}
                    name={sp.name}
                    color={sp.color}
                    coverPath={sp.cover_path}
                    onClick={() => {
                      onInternalNavigate?.();
                      navigate({ to: '/projects/$projectId', params: { projectId: sp.id } });
                    }}
                  />
                ))}
              </div>
            )}

            {section === 'modifications' && modManifests.length > 0 && (
              <div style={{ display: 'flex', marginLeft: 10 }}>
                {modManifests.slice(0, 6).map((m) => (
                  <AvatarChip
                    key={m.key}
                    name={m.name}
                    onClick={() => {
                      setActiveSection('modifications');
                      setFocusModKey(m.key);
                      setFocusModNonce((n) => n + 1);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        <button
          onClick={() => setSectionSettingsOpen((v) => !v)}
          title="Configurar abas do projeto"
          style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#999', padding: '4px 8px' }}
        >
          ⚙
        </button>

        {sectionSettingsOpen && (
          <ProjectSectionSettingsPopover
            config={sectionConfig}
            onSetDefault={setDefaultSection}
            onToggleEnabled={toggleSectionEnabled}
            onClose={() => setSectionSettingsOpen(false)}
          />
        )}
      </div>

      {activeSection === 'modules' && modules && (
        <ProjectModuleTabs
          projectId={projectId}
          projectName={project.name}
          modules={modules}
        />
      )}

      {activeSection === 'subprojects' && (
        <SubprojectsSection
          projectId={projectId}
          projectName={project.name}
        />
      )}

      {activeSection === 'modifications' && (
        <ModificationsSection
          projectId={projectId}
          projectName={project.name}
          focusKey={focusModKey}
          focusNonce={focusModNonce}
        />
      )}
      <ProjectSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        project={project}
        modules={modules}
        onToggleModule={toggleModule}
        onUpdated={() => { getProject(); setBreadcrumbRefresh((k) => k + 1); }}
        onDeleted={() => { onInternalNavigate?.(); navigate({ to: '/projects' }); }}
      />
    </div>
  )
}
