export type TaskStatus = 'todo' | 'doing' | 'done';

export interface TaskType {
  id: string;
  project_id: string;
  title: string;
  status: TaskStatus;
}
export interface CreateTaskInput {
  project_id: string;
  title: string;
  status?: TaskStatus;
}
export type UpdateTaskInput = Partial<Pick<TaskType, 'title' | 'status'>>;
