export interface ProjectType {
  id: string;
  name: string;
  color: string | null;
  cover_path: string | null;
  archived: number;
}
export interface CreateProjectInput {
  name: string;
  color?: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  color?: string | null;
  cover_path?: string | null;
  archived?: number;
}
