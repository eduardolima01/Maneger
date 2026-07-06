import { useState, useEffect } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useTasks } from '@/lib/hooks/useTasks'
import { getProjectById } from '@/lib/api/projects'
import { ProjectType } from '@/types/project.types'
import Button from '@/components/layout/Button'

export function Project() {
  const { projectId } = useParams({ from: '/projects/$projectId' })
  const navigate = useNavigate()

  const [project, setProject] = useState<ProjectType | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)

  useEffect(() => {
    getProjectById(Number(projectId)).then((p) => {
      setProject(p)
      setLoadingProject(false)
    })
  }, [projectId])

  const { tasks, loading, error, add, toggle, remove } = useTasks(Number(projectId))
  const [title, setTitle] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await add(title.trim())
    setTitle('')
  }

  if (loadingProject) return <p>Carregando projeto...</p>
  if (!project) return <p>Projeto não encontrado.</p>

  return (
    <div style={{ maxWidth: 480, margin: '2rem auto' }}>
      <Button
        variant="secondary"
        onClick={() => navigate({ to: '/projects' })}
        style={{ marginBottom: 16 }}
      >
        ← Voltar
      </Button>

      <h1>{project.name}</h1>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', gap: 8, marginBottom: 16 }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nova tarefa..."
          style={{ flex: 1, padding: 8 }}
        />
        <Button type="submit">Adicionar</Button>
      </form>

      {loading && <p>Carregando tarefas...</p>}
      {error && <p style={{ color: 'red' }}>Erro: {error}</p>}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {tasks.map((task) => (
          <li
            key={task.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid #eee',
            }}
          >
            <span
              onClick={() => toggle(task)}
              style={{
                cursor: 'pointer',
                textDecoration: task.done ? 'line-through' : 'none',
              }}
            >
              {task.title}
            </span>
            <Button variant="danger" onClick={() => remove(task.id)}>
              excluir
            </Button>
          </li>
        ))}
      </ul>

      {!loading && tasks.length === 0
        && <p>Nenhuma tarefa ainda neste projeto.</p>}
    </div>
  )
}

