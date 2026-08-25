import { useMemo, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';
import type { KanbanCardGroup, KanbanCard as CardType, KanbanDensity, ChecklistProgress } from '@/types/kanban.types';
import { clusterCardsByGroupLabel, ParsedLabel } from '@/Kanban/utils/kanbanLabels';
import LabelGroupBlock from '@/Kanban/utils/LabelGroupBlock';
import { DuplicateMultipleMode } from '@/Kanban/components/DuplicateMenu';

interface GroupBlockProps {
  group: KanbanCardGroup;
  cards: CardType[];
  density: KanbanDensity;
  cardsWithSubKanban: Set<string>;
  collapsed: boolean;
  checklistProgress: Record<string, ChecklistProgress>;
  allLabels: ParsedLabel[];
  onToggleCollapsed: () => void;
  onCardClick: (cardId: string) => void;
  onCardDuplicate: (cardId: string) => void;
  onCardRequestDelete: (cardId: string, title: string) => void;
  onRename: (name: string) => void;
  onRequestDelete: () => void;
  onAddCard: (title: string) => void;
  onUpdateCardLabels: (cardId: string, labels: string[]) => void;
  onUpdateCardDueDate: (cardId: string, dueDate: string | null) => void;
  onUpdateCardTitle: (cardId: string, title: string) => void;
  onUpdateCardColor: (cardId: string, color: string | null) => void;
  onDuplicateMultiple: (cardId: string, mode: DuplicateMultipleMode) => void;

  selectedCardIds: Set<string>;
  onCardSelectToggle: (cardId: string) => void;
  onBulkDelete: (cardIds: string[]) => void;
  onBulkSetColor: (cardIds: string[], color: string | null) => void;
  onBulkToggleLabel: (cardIds: string[], name: string, color: string, isGroup: boolean) => void;
  onUpdateCoverPath: (cardId: string, path: string) => void
}

export default function GroupBlock({
  group, cards, density, cardsWithSubKanban, collapsed, onToggleCollapsed, onCardClick, onCardDuplicate, onCardRequestDelete, onRename, onRequestDelete,
  onAddCard, allLabels, onUpdateCardLabels, checklistProgress,
  onUpdateCardDueDate, onUpdateCardTitle, onUpdateCardColor,
  selectedCardIds,
  onCardSelectToggle,
  onBulkDelete,
  onBulkSetColor,
  onBulkToggleLabel,
  onDuplicateMultiple,
  onUpdateCoverPath
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
  const { clusters, loose } = useMemo(() => clusterCardsByGroupLabel(cards), [cards]);

  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const newCardInputRef = useRef<HTMLTextAreaElement>(null);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  async function submitNewCard() {
    const lines = newCardTitle.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { setAddingCard(false); return; }
    for (const line of lines) {
      onAddCard(line); // sequencial: evita colisão de posição entre criações simultâneas
    }
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

        <div ref={setDroppableRef} style={{ minHeight: 30, maxHeight: 320, overflowY: 'auto' }}>

          {!collapsed && (
            <SortableContext items={cards.map((c) => `card:${c.id}`)} strategy={verticalListSortingStrategy}>
              {clusters.map((cluster) => (
                <LabelGroupBlock
                  key={`label-group:${cluster.name}`}
                  name={cluster.name}
                  color={cluster.color}
                  cards={cluster.cards}
                  density={density}
                  cardsWithSubKanban={cardsWithSubKanban}
                  checklistProgress={checklistProgress}
                  allLabels={allLabels}
                  scopeType="group"
                  scopeId={group.id}
                  onCardClick={onCardClick}
                  onCardDuplicate={onCardDuplicate}
                  onCardRequestDelete={onCardRequestDelete}

                  onDuplicateMultiple={onDuplicateMultiple}
                  selectedCardIds={selectedCardIds}
                  onCardSelectToggle={onCardSelectToggle}
                  onBulkDelete={onBulkDelete}
                  onUpdateCardLabels={onUpdateCardLabels}
                  onBulkSetColor={onBulkSetColor}
                  onBulkToggleLabel={onBulkToggleLabel}
                  onUpdateCardDueDate={onUpdateCardDueDate}
                  onUpdateCardTitle={onUpdateCardTitle}
                  onUpdateCardColor={onUpdateCardColor}
                />
              ))}

              {loose.map((c) => (
                <KanbanCard
                  key={c.id}
                  card={c}
                  density={density}
                  hasSubKanban={cardsWithSubKanban.has(c.id)}
                  checklistProgress={checklistProgress[c.id]}
                  onClick={() => onCardClick(c.id)}
                  onDuplicate={() => onCardDuplicate(c.id)}
                  onRequestDelete={() => onCardRequestDelete(c.id, c.title)}
                  allLabels={allLabels}
                  onUpdateLabels={onUpdateCardLabels}
                  onUpdateCardDueDate={onUpdateCardDueDate}
                  onUpdateTitle={onUpdateCardTitle}
                  onUpdateColor={onUpdateCardColor}
                  selectedCardIds={selectedCardIds}
                  onCardSelectToggle={onCardSelectToggle}
                  onBulkDelete={onBulkDelete}
                  onBulkSetColor={onBulkSetColor}
                  onBulkToggleLabel={onBulkToggleLabel}
                  onDuplicateMultiple={onDuplicateMultiple}
                  onUpdateCoverPath={onUpdateCoverPath}
                />
              ))}
            </SortableContext>
          )}

          {cards.length === 0 && (
            <div style={{ fontSize: 11, color: '#bbb', textAlign: 'center', padding: 8 }}>Arraste cards pra cá</div>
          )}

          {!collapsed && (
            addingCard ? (
              <textarea
                ref={newCardInputRef}
                autoFocus
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                onBlur={submitNewCard}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitNewCard();
                  }
                  if (e.key === 'Escape') { setNewCardTitle(''); setAddingCard(false); }
                }}
                placeholder="Título do card... (Shift+Enter = várias linhas viram vários cards)"
                rows={2}
                style={{ width: '100%', fontSize: 12, padding: 6, marginTop: 4, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
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

