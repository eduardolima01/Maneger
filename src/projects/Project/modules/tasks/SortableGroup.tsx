import TaskGroupSection, { TaskGroupSectionProps } from '@/Projects/components/TaskGroupSection';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableGroupProps extends Omit<TaskGroupSectionProps, 'dragHandleProps'> {
  id: string;
}

export default function SortableGroup({ id, ...rest }: SortableGroupProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'group' },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskGroupSection {...rest} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}
