
import type { TaskTypeComponentProps } from './taskTypeRegistry';

export default function NoteTask({ task }: TaskTypeComponentProps) {
  return (
    <div style={{ fontSize: 13, color: task.description ? '#333' : '#bbb', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
      {task.description || 'Sem conteúdo ainda...'}
    </div>
  );
}
