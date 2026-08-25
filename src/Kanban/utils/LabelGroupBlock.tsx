import { useState } from 'react';
import type { KanbanCard as CardType, ChecklistProgress, KanbanDensity } from '@/types/kanban.types';
import { ParsedLabel } from './kanbanLabels';
import KanbanCard from '@/Projects/Project/modules/kanban/KanbanCard';
import { useDroppable } from '@dnd-kit/core';
import { DuplicateMultipleMode } from '../components/DuplicateMenu';

interface LabelGroupBlockProps {
  name: string;
  color: string;
  cards: CardType[];
  density: KanbanDensity;
  cardsWithSubKanban: Set<string>;
  checklistProgress: Record<string, ChecklistProgress>;
  allLabels: ParsedLabel[];
  scopeType: 'column' | 'group';
  scopeId: string;
  onCardClick: (cardId: string) => void;
  onCardDuplicate: (cardId: string) => void;
  onCardRequestDelete: (cardId: string, title: string) => void;
  onUpdateCardLabels: (cardId: string, labels: string[]) => void;
  onUpdateCardDueDate: (cardId: string, dueDate: string | null) => void;
  onUpdateCardTitle: (cardId: string, title: string) => void;
  onUpdateCardColor: (cardId: string, color: string | null) => void;
  onDuplicateMultiple: (cardId: string, mode: DuplicateMultipleMode) => void;
  onUpdateCoverPath: (cardId: string, path: string) => void

  selectedCardIds: Set<string>;
  onCardSelectToggle: (cardId: string) => void;
  onBulkDelete: (cardIds: string[]) => void;
  onBulkSetColor: (cardIds: string[], color: string | null) => void;
  onBulkToggleLabel: (cardIds: string[], name: string, color: string, isGroup: boolean) => void;
}

export default function LabelGroupBlock({
  name, color, cards, density, cardsWithSubKanban, checklistProgress, allLabels,
  scopeType, scopeId,
  onCardClick, onCardDuplicate, onCardRequestDelete, onUpdateCardLabels,
  onUpdateCardDueDate, onUpdateCardTitle, onUpdateCardColor,
  selectedCardIds, onCardSelectToggle, onBulkDelete, onBulkSetColor, onBulkToggleLabel,
  onDuplicateMultiple, onUpdateCoverPath
}: LabelGroupBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const droppableId = `labelgroup:${scopeType}:${scopeId}:${name}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: 'label-group', scopeType, scopeId, labelName: name, labelColor: color },
  });

  return (
    <div style={{ marginBottom: 8 }}>
      <div ref={setNodeRef} style={{ border: '2px dashed #c7c7c7', borderRadius: 6, padding: 6, backgroundColor: isOver ? '#e8f0fe' : '#f5f5f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <button
            onClick={() => setCollapsed((v) => !v)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, color: '#666', padding: 0 }}
          >
            {collapsed ? '▶' : '▼'}
          </button>
          <span title="Subgrupo por etiqueta" style={{ color: '#999', fontSize: 11 }}>🏷</span>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{name}</span>
          <span style={{ fontSize: 10, color: '#999' }}>({cards.length})</span>
        </div>

        {!collapsed && (
          <div style={{ minHeight: 30, maxHeight: 320, overflowY: 'auto' }}>
            {cards.map((c) => (
              <KanbanCard
                key={c.id}
                card={c}
                density={density}
                hasSubKanban={cardsWithSubKanban.has(c.id)}
                checklistProgress={checklistProgress[c.id]}
                allLabels={allLabels}
                onClick={() => onCardClick(c.id)}
                onDuplicate={() => onCardDuplicate(c.id)}
                onRequestDelete={() => onCardRequestDelete(c.id, c.title)}
                onUpdateLabels={onUpdateCardLabels}
                onUpdateCardDueDate={onUpdateCardDueDate}
                onUpdateTitle={onUpdateCardTitle}
                onUpdateColor={onUpdateCardColor}
                onDuplicateMultiple={onDuplicateMultiple}
                onUpdateCoverPath={onUpdateCoverPath}
                selectedCardIds={selectedCardIds}
                onCardSelectToggle={onCardSelectToggle}
                onBulkDelete={onBulkDelete}
                onBulkSetColor={onBulkSetColor}
                onBulkToggleLabel={onBulkToggleLabel}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
