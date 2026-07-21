import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import KanbanCard from './KanbanCard';

import type {
  KanbanColumn as ColumnType,
  KanbanCard as CardType,
  KanbanDensity
} from '@/types/kanban.types';

interface KanbanColumnProps {
  column: ColumnType;
  cards: CardType[];
  density: KanbanDensity;
  width: number;
  onCardClick: (cardId: string) => void;
  onRename: (name: string) => void;
  onColumnMenu: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function KanbanColumn({
  column,
  cards,
  density,
  width,
  onCardClick,
  onRename,
  onColumnMenu,
  collapsed,
  onToggleCollapsed
}: KanbanColumnProps) {
  const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column' },
  });
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: column.id, data: { type: 'column', columnId: column.id } });
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(column.name);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width,
    flexShrink: 0,
  };

  const overLimit = column.wipLimit !== null && cards.length > column.wipLimit;

  return (
    <div ref={setSortableRef} style={style}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f5f5f5', borderRadius: 8, padding: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <button onClick={onToggleCollapsed} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11 }}>
            {collapsed ? '▶' : '▼'}
          </button>
          <span {...attributes} {...listeners} style={{ cursor: 'grab', color: '#bbb', fontSize: 12 }} title="Arrastar">⠿</span>
          {column.icon && <span>{column.icon}</span>}
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => { setEditingName(false); nameDraft.trim() && nameDraft !== column.name && onRename(nameDraft.trim()); }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              style={{ fontSize: 13, fontWeight: 600, flex: 1, padding: 2 }}
            />
          ) : (
            <span onClick={() => setEditingName(true)} style={{ fontSize: 13, fontWeight: 600, flex: 1, color: column.color ?? undefined }}>
              {column.name}
            </span>
          )}
          <button onClick={onColumnMenu} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>⋮</button>
        </div>

        <div style={{ fontSize: 11, color: overLimit ? '#c62828' : '#666', marginBottom: 6, display: 'flex', gap: 8 }}>
          <span>{cards.length} card{cards.length !== 1 ? 's' : ''}</span>
          {column.wipLimit !== null && <span>WIP: {cards.length}/{column.wipLimit}</span>}
        </div>

        {!collapsed && (
          <div ref={setDroppableRef} style={{ flex: 1, overflowY: 'auto', minHeight: 40, borderRadius: 6, backgroundColor: isOver ? '#e8f0fe' : 'transparent', padding: 2 }}>
            <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {cards.map((c) => (
                <KanbanCard
                  key={c.id}
                  card={c}
                  density={density}
                  onClick={() => onCardClick(c.id)}
                />
              ))}
            </SortableContext>
          </div>
        )}
      </div>
    </div>
  );
}
