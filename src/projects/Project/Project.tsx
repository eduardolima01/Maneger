import { useParams } from '@tanstack/react-router'
import { ProjectFullView } from './ProjectFullView'

export function Project() {
  const { projectId } = useParams({ from: '/projects/$projectId' })
  return <ProjectFullView projectId={projectId} />
}
