import type { Task } from '@/types/task/task.types';
import { TASK_TYPE_COMPONENTS } from './taskTypeRegistry';

interface TaskRendererProps {
  task: Task;
  onUpdatePayload: (payload: Task['payload']) => void;
}

export default function TaskRenderer({ task, onUpdatePayload }: TaskRendererProps) {
  const Component = TASK_TYPE_COMPONENTS[task.type];
  return <Component task={task} onUpdatePayload={onUpdatePayload} />;
}
