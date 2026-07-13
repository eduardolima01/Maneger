import { useState } from 'react';
import SubtaskRow from './SubtaskRow';
import type { Subtask } from '@/types/task/subtask.types';

interface SubtaskListProps {
  subtasks: Subtask[];
  onToggle: (id: string, checked: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

export default function SubtaskList({ subtasks, onToggle, onRename, onDelete, onReorder }: SubtaskListProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function handleDrop(targetId: string) {
    if (draggedId && draggedId !== targetId) {
      const ids = subtasks.map((s) => s.id);
      const fromIndex = ids.indexOf(draggedId);
      const toIndex = ids.indexOf(targetId);
      ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, draggedId);
      onReorder(ids);
    }
    setDraggedId(null);
    setOverId(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {subtasks.map((s) => (
        <SubtaskRow
          key={s.id}
          subtask={s}
          isDragOver={overId === s.id}
          onDragStart={() => setDraggedId(s.id)}
          onDragOver={() => setOverId(s.id)}
          onDragLeave={() => setOverId((id) => (id === s.id ? null : id))}
          onDrop={() => handleDrop(s.id)}
          onToggle={(checked) => onToggle(s.id, checked)}
          onRename={(title) => onRename(s.id, title)}
          onDelete={() => onDelete(s.id)}
        />
      ))}
    </div>
  );
}
