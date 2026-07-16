export interface ProjectType {
  id: string;
  parentProjectId: string | null;
  name: string;
  description: string | null;
  color: string | null;
  cover_path: string | null;
  archived: number;
  position: number;
}
export interface CreateProjectInput {
  name: string;
  description?: string | null;
  color?: string | null;
  parentProjectId?: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  color?: string | null;
  cover_path?: string | null;
  archived?: number;
  parentProjectId?: string | null;
}
