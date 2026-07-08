export interface ProjectType {
  id: string;
  name: string;
  color: string | null;
}
export interface CreateProjectInput {
  name: string;
  color?: string | null;
}
export type UpdateProjectInput = Partial<CreateProjectInput>;
