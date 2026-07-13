export interface TaskGroup {
  id: string;
  projectId: string;
  name: string;
}

export interface CreateTaskGroupInput {
  projectId: string;
  name: string;
}

export type UpdateTaskGroupInput = Partial<Pick<CreateTaskGroupInput, 'name'>>;
