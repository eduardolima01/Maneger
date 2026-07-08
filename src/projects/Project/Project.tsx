import { useState, useEffect } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'

import { getProjectById } from '@/lib/api/projects'
import { ProjectType } from '@/types/project.types'
import Button from '@/components/layout/Button'
import { useProjectModules } from '@/lib/hooks/useProjectModules'
import AgendaSection from './AgendaSection';

import ProjectSettingsModal from './ProjectSettingsModal';
import TasksSection from './TasksSection';
import KanbanBoard from './KanbanBoard';
import NotesSection from './NotesSection';

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
      <div className="flex items-center justify-between my-4">
        <h1>{project.name}</h1>
        <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
          ⚙ Configurações
        </Button>
      </div>

      {modules?.tasks && <TasksSection projectId={projectId} />}
      {modules?.kanban && <KanbanBoard projectId={projectId} />}
      {modules?.notes && <NotesSection projectId={projectId} />}
      {modules?.agenda && <AgendaSection projectId={projectId} />}

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

