import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { convertFileSrc } from '@tauri-apps/api/core';
import { PRIORITY_LABELS, PRIORITY_COLORS } from '@/types/kanban.types';
import type { KanbanCard as CardType, ChecklistProgress, KanbanDensity } from '@/types/kanban.types';
import ContextMenu from '@/components/ui/ContextMenu';
import { useState } from 'react';

interface KanbanCardProps {
  card: CardType;
  density: KanbanDensity;
  hasSubKanban: boolean;
  checklistProgress?: ChecklistProgress;
  onClick: () => void;
  onDuplicate: () => void;
  onRequestDelete: () => void;
}


export default function KanbanCard({ card, density, hasSubKanban, onClick, onDuplicate, onRequestDelete, checklistProgress }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card:${card.id}`,
    data: { type: 'card' },
  });

  const compact = density === 'compact';

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  return (

    <>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={onClick}
        onContextMenu={handleContextMenu}
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
          {hasSubKanban && (
            <span title="Tem sub-kanban" style={{ fontSize: 11 }}>📋</span>
          )}
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

            {checklistProgress && checklistProgress.total > 0 && (
              <span style={{ color: checklistProgress.done === checklistProgress.total ? '#33b679' : '#666' }}>
                ☑ {checklistProgress.done}/{checklistProgress.total} ({Math.round((checklistProgress.done / checklistProgress.total) * 100)}%)
              </span>
            )}

            {card.dueDate && <span style={{ color: '#666' }}>📅 {card.dueDate}</span>}
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { label: '⧉ Duplicar', onClick: onDuplicate },
            { label: '🗑 Excluir', onClick: onRequestDelete, danger: true },
          ]}
        />
      )}
    </>
  );
}

