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

function TabMetaReporter({ title, status, breadcrumb, coverPath }: {
  title: string;
  status: 'loading' | 'ready' | 'not-found';
  breadcrumb?: string[];
  coverPath?: string | null;
}) {
  useTabMeta({
    title,
    icon: '📁',
    iconUrl: coverPath ? convertFileSrc(coverPath) : undefined,
    status,
    breadcrumb,
  });
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
  // Painel de identidade (capa + nome) e navegação de seções agrupados;
  // começa fechado por padrão pra priorizar o espaço do conteúdo.
  const [panelOpen, setPanelOpen] = useState(false)

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

  const enabledSections = SECTION_ORDER.filter((section) => sectionConfig.enabledSections[section])

  return (
    <div style={{ width: '100%', maxWidth: '95vw', margin: '1rem auto', padding: '0 24px' }}>
      {reportTabMeta && (
        <TabMetaReporter
          title={project.name}
          status="ready"
          breadcrumb={[project.name]}
          coverPath={project.cover_path}
        />
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <ProjectBreadcrumb
            projectId={projectId}
            refreshToken={breadcrumbRefresh}
          />
        </div>
        <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
          ⚙ Configurações
        </Button>
      </div>

      {/*
        Painel de identidade do projeto (capa + nome) e navegação de seções,
        agrupados num único bloco recolhível. Fechado por padrão: mostra só
        uma faixa fina com o inicial do projeto e círculos por seção pra
        trocar de aba sem precisar abrir o painel.
      */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginTop: 12 }}>
        <div
          style={{
            width: panelOpen ? 180 : 32,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            borderRight: '1px solid #e0e0e0',
            paddingRight: panelOpen ? 12 : 4,
            position: 'relative',
            transition: 'width 0.15s ease, padding-right 0.15s ease',
          }}
        >
          <button
            onClick={() => setPanelOpen((v) => !v)}
            title={panelOpen ? 'Esconder painel do projeto' : 'Mostrar painel do projeto'}
            style={{
              alignSelf: panelOpen ? 'flex-end' : 'center',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: '#999',
              padding: '2px 4px',
              marginBottom: 6,
            }}
          >
            {panelOpen ? '◀' : '▶'}
          </button>

          {panelOpen ? (
            <>
              {project.cover_path && (
                <img
                  src={convertFileSrc(project.cover_path)}
                  style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
                />
              )}

              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <div
                  className="flex w-2 h-6"
                  style={{ backgroundColor: project.color || '#1a73e8', flexShrink: 0 }}
                />
                <h1 style={{ fontSize: 16, margin: 0, lineHeight: 1.2, wordBreak: 'break-word' }}>
                  {project.name}
                </h1>
              </div>

              <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {enabledSections.map((section) => (
                  <div
                    key={section}
                    onClick={() => setActiveSection(section)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: '8px 10px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      background: activeSection === section ? '#e8f0fe' : 'transparent',
                      color: activeSection === section ? '#1a73e8' : '#666',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{SECTION_LABELS[section]}</span>

                    {section === 'subprojects' && subprojects.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
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
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
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
                  title="Configurar seções do projeto"
                  style={{ marginTop: 8, alignSelf: 'flex-start', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#999', padding: '4px 8px' }}
                >
                  ⚙ Seções
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
            </>
          ) : (
            <>
              {/* Faixa fechada: inicial do projeto (identidade) + círculos por seção pra trocar sem abrir o painel */}
              <div
                title={project.name}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                  background: project.color || '#1a73e8',
                  margin: '0 auto 8px',
                }}
              >
                {project.name.charAt(0).toUpperCase()}
              </div>

              {enabledSections.map((section) => (
                <div
                  key={section}
                  onClick={() => setActiveSection(section)}
                  title={SECTION_LABELS[section]}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    margin: '2px auto',
                    background: activeSection === section ? '#e8f0fe' : 'transparent',
                    color: activeSection === section ? '#1a73e8' : '#999',
                    cursor: 'pointer',
                  }}
                >
                  {SECTION_LABELS[section].charAt(0).toUpperCase()}
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
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
        </div>
      </div>

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
