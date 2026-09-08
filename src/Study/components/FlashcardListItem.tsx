import type { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MdDragIndicator } from 'react-icons/md';
import MarkdownView from './MarkdownView';
import type { Flashcard } from '../types/study.types';

interface FlashcardListItemProps {
  card: Flashcard;
  index: number;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export default function FlashcardListItem({ card, index, onEdit, onDuplicate, onDelete }: FlashcardListItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: 12,
        border: '1px solid #e0e0e0',
        borderRadius: 6,
        background: '#fff',
        marginBottom: 8,
      }}
    >
      <button
        {...attributes}
        {...listeners}
        style={{ border: 'none', background: 'none', cursor: 'grab', color: '#999', padding: 2 }}
        aria-label="Arrastar para reordenar"
      >
        <MdDragIndicator size={18} />
      </button>

      <span style={{ fontSize: 11, color: '#999', minWidth: 20, marginTop: 4 }}>#{index + 1}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <MarkdownView value={card.front} />
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={onEdit} title="Editar" style={iconBtnStyle}>✎</button>
        <button onClick={onDuplicate} title="Duplicar" style={iconBtnStyle}>⧉</button>
        <button onClick={onDelete} title="Excluir" style={iconBtnStyle}>🗑</button>
      </div>
    </div>
  );
}

const iconBtnStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: 14,
  padding: 4,
  borderRadius: 4,
};
