import { useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';
import type { KanbanCardGroup, KanbanCard as CardType, KanbanDensity } from '@/types/kanban.types';
import { ParsedLabel } from '@/Kanban/utils/kanbanLabels';

interface GroupBlockProps {
  group: KanbanCardGroup;
  cards: CardType[];
  density: KanbanDensity;
  cardsWithSubKanban: Set<string>;
  collapsed: boolean;
  allLabels: ParsedLabel[];
  onToggleCollapsed: () => void;
  onCardClick: (cardId: string) => void;
  onCardDuplicate: (cardId: string) => void;
  onCardRequestDelete: (cardId: string, title: string) => void;
  onRename: (name: string) => void;
  onRequestDelete: () => void;
  onAddCard: (title: string) => void;
  onUpdateCardLabels: (cardId: string, labels: string[]) => void;
}

export default function GroupBlock({
  group, cards, density, cardsWithSubKanban, collapsed, onToggleCollapsed, onCardClick, onCardDuplicate, onCardRequestDelete, onRename, onRequestDelete,
  onAddCard, allLabels, onUpdateCardLabels,
}: GroupBlockProps) {
  const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging } = useSortable({
    id: `group:${group.id}`,
    data: { type: 'group', groupId: group.id },
  });
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `group:${group.id}`,
    data: { type: 'group', groupId: group.id },
  });
  const [nameDraft, setNameDraft] = useState(group.name);

  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const newCardInputRef = useRef<HTMLInputElement>(null);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function submitNewCard() {
    const trimmed = newCardTitle.trim();
    if (!trimmed) { setAddingCard(false); return; }
    onAddCard(trimmed);
    setNewCardTitle('');
    newCardInputRef.current?.focus(); // mantém o input focado — permite criar vários em sequência
  }

  return (
    <div ref={setSortableRef} style={{ ...style, marginBottom: 8 }}>
      <div style={{ border: '2px dashed #c7c7c7', borderRadius: 6, padding: 6, backgroundColor: isOver ? '#e8f0fe' : '#f5f5f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <span {...attributes} {...listeners} style={{ color: '#999', fontSize: 11, cursor: 'grab', touchAction: 'none' }} title="Arrastar grupo">⠿</span>
          <button
            onClick={onToggleCollapsed}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, color: '#666', padding: 0 }}
          >
            {collapsed ? '▶' : '▼'}
          </button>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => nameDraft.trim() && nameDraft !== group.name && onRename(nameDraft.trim())}
            style={{ flex: 1, fontSize: 12, fontWeight: 600, border: 'none', background: 'none', outline: 'none' }}
          />
          <span style={{ fontSize: 10, color: '#999' }}>({cards.length})</span>
          <button onClick={onRequestDelete} title="Desagrupar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 11 }}>✕</button>
        </div>

        <div ref={setDroppableRef} style={{ minHeight: 30 }}>

          {!collapsed && (
            <SortableContext items={cards.map((c) => `card:${c.id}`)} strategy={verticalListSortingStrategy}>
              {cards.map((c) => (
                <KanbanCard
                  key={c.id}
                  card={c}
                  density={density}
                  hasSubKanban={cardsWithSubKanban.has(c.id)}
                  onClick={() => onCardClick(c.id)}
                  onDuplicate={() => onCardDuplicate(c.id)}
                  onRequestDelete={() => onCardRequestDelete(c.id, c.title)}
                  allLabels={allLabels}
                  onUpdateLabels={onUpdateCardLabels}
                />
              ))}
            </SortableContext>
          )}

          {cards.length === 0 && (
            <div style={{ fontSize: 11, color: '#bbb', textAlign: 'center', padding: 8 }}>Arraste cards pra cá</div>
          )}

          {!collapsed && (
            addingCard ? (
              <input
                ref={newCardInputRef}
                autoFocus
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                onBlur={submitNewCard}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNewCard();
                  if (e.key === 'Escape') { setNewCardTitle(''); setAddingCard(false); }
                }}
                placeholder="Título do card..."
                style={{ width: '100%', fontSize: 12, padding: 6, marginTop: 4, boxSizing: 'border-box' }}
              />
            ) : (
              <button
                onClick={() => setAddingCard(true)}
                style={{ width: '100%', textAlign: 'left', fontSize: 11, color: '#999', border: 'none', background: 'none', cursor: 'pointer', padding: '4px 2px', marginTop: 2 }}
              >
                + Adicionar card
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

