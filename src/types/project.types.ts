export interface ProjectType {
  id: string;
  name: string;
}
export interface CreateProjectInput {
  name: string;
}
export type UpdateProjectInput = Partial<Pick<ProjectType, 'name'>>;
