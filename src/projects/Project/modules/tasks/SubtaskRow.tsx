import { useState } from 'react';
import type { Subtask } from '@/types/task/subtask.types';

interface SubtaskRowProps {
  subtask: Subtask;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onToggle: (checked: boolean) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

export default function SubtaskRow({
  subtask, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onToggle, onRename, onDelete,
}: SubtaskRowProps) {
  const [titleDraft, setTitleDraft] = useState(subtask.title);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 8px',
        border: '1px solid #eee',
        borderRadius: 4,
        backgroundColor: isDragOver ? '#e8f0fe' : '#fff',
        cursor: 'grab',
      }}
    >
      <span style={{ color: '#bbb', fontSize: 12 }}>⠿</span>
      <input type="checkbox" checked={subtask.checked} onChange={(e) => onToggle(e.target.checked)} />
      <input
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={() => titleDraft.trim() && titleDraft !== subtask.title && onRename(titleDraft.trim())}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          fontSize: 13,
          background: 'transparent',
          textDecoration: subtask.checked ? 'line-through' : 'none',
          color: subtask.checked ? '#999' : '#000',
        }}
      />
      <button onClick={onDelete} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 12 }}>✕</button>
    </div>
  );
}
