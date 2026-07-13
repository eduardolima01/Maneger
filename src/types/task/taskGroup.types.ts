export interface TaskGroup {
  id: string;
  project_id: string;
  name: string;
}

export interface CreateTaskGroupInput {
  project_id: string;
  name: string;
}

export type UpdateTaskGroupInput = Partial<Pick<CreateTaskGroupInput, 'name'>>;
