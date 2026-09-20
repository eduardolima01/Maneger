import { useState } from 'react';
import type { KanbanCard as CardType, ChecklistProgress, KanbanDensity, TaskStatus, CardVisualFieldConfig } from '@/types/kanban.types';
import { ParsedLabel } from './kanbanLabels';
import { useDroppable } from '@dnd-kit/core';
import { DuplicateMultipleMode } from '../components/DuplicateMenu';
import KanbanCard from '@/Projects/Project/modules/kanban/KanbanCard';

interface LabelGroupBlockProps {
  name: string;
  color: string;
  cards: CardType[];
  density: KanbanDensity;
  visualConfig: CardVisualFieldConfig[];
  cardsWithSubKanban: Set<string>;
  cardsWithFiles: Set<string>;
  checklistProgress: Record<string, ChecklistProgress>;
  allLabels: ParsedLabel[];
  scopeType: 'column' | 'group';
  scopeId: string;
  onCardClick: (cardId: string) => void;
  onCardDuplicate: (cardId: string) => void;
  onCardRequestDelete: (cardId: string, title: string) => void;
  onUpdateCardLabels: (cardId: string, labels: string[]) => void;
  onUpdateCardDueDate: (cardId: string, dueDate: string | null) => void;
  onUpdateCardStartDate: (cardId: string, startDate: string | null) => void;
  onUpdateCardDescription: (cardId: string, description: string | null) => void;
  onUpdateCardTitle: (cardId: string, title: string) => void;
  onUpdateCardColor: (cardId: string, color: string | null) => void;
  onUpdateCardStatus: (cardId: string, status: TaskStatus | null) => void;
  onDuplicateMultiple: (cardId: string, mode: DuplicateMultipleMode) => void;
  onUpdateCoverPath: (cardId: string, path: string) => void
  projectId: string;

  selectedCardIds: Set<string>;
  onCardSelectToggle: (cardId: string) => void;
  onBulkDelete: (cardIds: string[]) => void;
  onBulkSetColor: (cardIds: string[], color: string | null) => void;
  onBulkSetStatus: (cardIds: string[], status: TaskStatus | null) => void;
  onBulkToggleLabel: (cardIds: string[], name: string, color: string, isGroup: boolean) => void;
}

export default function LabelGroupBlock({
  name, color, cards, density, visualConfig, cardsWithSubKanban, cardsWithFiles, checklistProgress, allLabels,
  scopeType, scopeId,
  onCardClick, onCardDuplicate, onCardRequestDelete, onUpdateCardLabels,
  onUpdateCardDueDate, onUpdateCardStartDate, onUpdateCardDescription, onUpdateCardTitle, onUpdateCardColor, onUpdateCardStatus,
  selectedCardIds, onCardSelectToggle, onBulkDelete, onBulkSetColor, onBulkSetStatus, onBulkToggleLabel,
  onDuplicateMultiple, onUpdateCoverPath,
  projectId
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
                visualConfig={visualConfig}
                hasSubKanban={cardsWithSubKanban.has(c.id)}
                hasFiles={cardsWithFiles.has(c.id)}
                checklistProgress={checklistProgress[c.id]}
                allLabels={allLabels}
                onClick={() => onCardClick(c.id)}
                onDuplicate={() => onCardDuplicate(c.id)}
                onRequestDelete={() => onCardRequestDelete(c.id, c.title)}
                onUpdateLabels={onUpdateCardLabels}
                onUpdateCardDueDate={onUpdateCardDueDate}
                onUpdateStartDate={onUpdateCardStartDate}
                onUpdateDescription={onUpdateCardDescription}
                onUpdateTitle={onUpdateCardTitle}
                onUpdateColor={onUpdateCardColor}
                onUpdateStatus={onUpdateCardStatus}
                onDuplicateMultiple={onDuplicateMultiple}
                onUpdateCoverPath={onUpdateCoverPath}
                selectedCardIds={selectedCardIds}
                onCardSelectToggle={onCardSelectToggle}
                onBulkDelete={onBulkDelete}
                onBulkSetColor={onBulkSetColor}
                onBulkSetStatus={onBulkSetStatus}
                onBulkToggleLabel={onBulkToggleLabel}
                projectId={projectId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
