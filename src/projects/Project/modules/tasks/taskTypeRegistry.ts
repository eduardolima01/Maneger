import type { ComponentType } from 'react';
import type { Task } from '@/types/task/task.types';

import NoteTask from './NoteTask';
import CheckboxTask from './CheckboxTask';
import StatusTask from './StatusTask';

export interface TaskTypeComponentProps {
  task: Task;
  onUpdatePayload: (payload: Task['payload']) => void;
}

// TS não consegue estreitar automaticamente o payload aqui por causa do lookup dinâmico
// (Record<TaskType, Component> perde a correlação type→payload que a union discriminada tem).
// Cada componente abaixo faz um cast interno seguro, sabendo que só é montado pro próprio `type`.
export const TASK_TYPE_COMPONENTS: Record<Task['type'], ComponentType<TaskTypeComponentProps>> = {
  note: NoteTask,
  checkbox: CheckboxTask,
  status: StatusTask,
};
