import { useState, useEffect } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { getProjectById } from '@/lib/api/projects'
import { ProjectType } from '@/types/project.types'
import Button from '@/components/layout/Button'
import { useProjectModules } from '@/lib/hooks/useProjectModules'
import ProjectSettingsModal from './ProjectSettingsModal';
import ProjectModuleTabs from './modules/ProjectModuleTabs';
import { convertFileSrc } from '@tauri-apps/api/core';

export function Project() {
  const [project, setProject] = useState<ProjectType | null>(null)
  const { projectId } = useParams({ from: '/projects/$projectId' })
  const [loadingProject, setLoadingProject] = useState(true)
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { modules, toggle: toggleModule } = useProjectModules(projectId)
  const getProject = async () => await
    getProjectById(projectId).then((p) => {
      setProject(p)
      setLoadingProject(false)
    })
  useEffect(() => {
    getProject()
  }, [projectId])
  if (loadingProject || !project) return <p>Carregando projeto...</p>
  return (
    <div style={{ maxWidth: 480, margin: '2rem auto' }}>
      <Button
        variant="secondary"
        onClick={() => navigate({ to: '/projects' })}
        style={{ marginBottom: 16 }}
      >
        ← Voltar
      </Button>

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
      {modules && (
        <ProjectModuleTabs
          projectId={projectId}
          projectName={project.name}
          modules={modules}
        />
      )}

      <ProjectSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        project={project}
        modules={modules}
        onToggleModule={toggleModule}
        onUpdated={() => { /* recarregar dados do projeto, se necessário */ }}
        onDeleted={() => { /* navegar de volta pra /projects */ }}
      />
    </div>
  )
}
