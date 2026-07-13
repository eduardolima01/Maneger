export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  description: string;
  due_date: string | null; // 'YYYY-MM-DD'
  done: number; // SQLite INTEGER 0/1
}

export interface CreateSubtaskInput {
  task_id: string;
  title: string;
  description?: string;
  due_date?: string | null;
}

export type UpdateSubtaskInput = Partial<{
  title: string;
  description: string;
  due_date: string | null;
  done: number;
}>;
