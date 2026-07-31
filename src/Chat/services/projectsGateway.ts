import { getAllProjects } from '@/lib/api/projects';

export interface ProjectRef {
  id: string;
  name: string;
}

export async function findProjectByName(name: string): Promise<ProjectRef | null> {
  const projects = await getAllProjects();
  const match = projects.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
  return match ? { id: match.id, name: match.name } : null;
}

export async function getProjectName(id: string): Promise<string | null> {
  const projects = await getAllProjects();
  return projects.find((p) => p.id === id)?.name ?? null;
}

