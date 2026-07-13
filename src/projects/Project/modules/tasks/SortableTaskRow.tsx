import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskRenderer from './TaskRenderer';
import type { Task, TaskPayload } from '@/types/task/task.types';

interface SortableTaskRowProps {
  task: Task;
  subtaskCount?: { total: number; done: number };
  onOpen: () => void;
  onUpdatePayload: (payload: TaskPayload) => void;
}

export default function SortableTaskRow({ task, subtaskCount, onOpen, onUpdatePayload }: SortableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task:${task.id}`,
    data: { type: 'task', groupId: task.groupId },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4 }}>
      <span
        {...attributes}
        {...listeners}
        style={{ color: '#bbb', fontSize: 12, cursor: 'grab', touchAction: 'none' }}
        title="Arrastar"
      >
        ⠿
      </span>

      <span style={{ fontSize: 14 }}>{task.type === 'note' ? '📝' : task.type === 'status' ? '🚦' : ''}</span>
      <span onClick={onOpen} style={{ flex: 1, fontSize: 14, cursor: 'pointer' }}>{task.title}</span>
      {subtaskCount && subtaskCount.total > 0 && <span style={{ fontSize: 11, color: '#666' }}>{subtaskCount.done}/{subtaskCount.total}</span>}
      <div onClick={(e) => e.stopPropagation()}>
        <TaskRenderer task={task} onUpdatePayload={onUpdatePayload} />
      </div>
    </div>
  );
}
