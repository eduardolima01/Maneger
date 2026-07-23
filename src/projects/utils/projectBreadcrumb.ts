import { buildAncestorChain } from './hierarchy';
import type { ProjectType } from '@/types/project.types';

export function buildProjectBreadcrumbPath(allProjects: ProjectType[], projectId: string): ProjectType[] {
  const byId = new Map(allProjects.map((p) => [p.id, p]));
  return buildAncestorChain(byId, projectId, (p) => p.id, (p) => p.parentProjectId);
}

export function buildBreadcrumbLabel(allProjects: ProjectType[], projectId: string, separator = ' / '): string {
  return buildProjectBreadcrumbPath(allProjects, projectId).map((p) => p.name).join(separator);
}
