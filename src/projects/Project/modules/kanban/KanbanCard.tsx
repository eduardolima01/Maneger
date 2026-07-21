import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { convertFileSrc } from '@tauri-apps/api/core';
import { PRIORITY_LABELS, PRIORITY_COLORS } from '@/types/kanban.types';
import type { KanbanCard as CardType, KanbanDensity } from '@/types/kanban.types';

interface KanbanCardProps {
  card: CardType;
  density: KanbanDensity;
  onClick: () => void;
}

export default function KanbanCard({ card, density, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card' },
  });

  const compact = density === 'compact';

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        border: card.color ? `1px solid ${card.color}` : '1px solid #e5e7eb',
        borderLeft: card.color ? `4px solid ${card.color}` : undefined,
        borderRadius: 6,
        padding: compact ? 6 : 10,
        marginBottom: 8,
        backgroundColor: '#fff',
        cursor: 'grab',
      }}
    >
      {!compact && card.coverPath && (
        <img src={convertFileSrc(card.coverPath)} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4, marginBottom: 6 }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: compact ? 0 : 4 }}>
        <span style={{ fontSize: compact ? 12 : 13, fontWeight: 500, flex: 1 }}>{card.title}</span>
        {card.priority && (
          <span
            title={PRIORITY_LABELS[card.priority]}
            style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: PRIORITY_COLORS[card.priority], flexShrink: 0 }}
          />
        )}
      </div>

      {!compact && card.description && (
        <p style={{ fontSize: 11, color: '#666', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {card.description}
        </p>
      )}

      {!compact && (card.labels.length > 0 || card.dueDate) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, fontSize: 10 }}>
          {card.labels.map((label) => (
            <span key={label} style={{ backgroundColor: '#eef2ff', color: '#4338ca', borderRadius: 3, padding: '1px 5px' }}>{label}</span>
          ))}
          {card.dueDate && <span style={{ color: '#666' }}>📅 {card.dueDate}</span>}
        </div>
      )}
    </div>
  );
}
