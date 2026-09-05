import { useMemo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import KanbanCard from './KanbanCard';

import type {
  KanbanColumn as ColumnType,
  KanbanCard as CardType,
  KanbanDensity,
  KanbanCardGroup,
  ChecklistProgress
} from '@/types/kanban.types';
import GroupBlock from './GroupBlock';
import { clusterCardsByGroupLabel, ParsedLabel } from '@/Kanban/utils/kanbanLabels';
import LabelGroupBlock from '@/Kanban/utils/LabelGroupBlock';
import { DuplicateMultipleMode } from '@/Kanban/components/DuplicateMenu';

interface KanbanColumnProps {
  column: ColumnType;
  cards: CardType[];
  groups: KanbanCardGroup[];
  cardsByGroup: Map<string, CardType[]>;
  collapsedGroupIds: Set<string>;
  onToggleGroupCollapsed: (groupId: string) => void;
  density: KanbanDensity;
  width: number;
  cardsWithSubKanban: Set<string>;
  onCardClick: (cardId: string, focusDescription?: boolean) => void;
  onCardDuplicate: (cardId: string) => void;
  onCardRequestDelete: (cardId: string, title: string) => void;
  onRename: (name: string) => void;
  onColumnMenu: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onRequestDeleteGroup: (groupId: string) => void;
  onAddCardToGroup: (groupId: string, title: string) => void;
  onReorderGroupCards: (orderedIds: string[]) => void;
  checklistProgress: Record<string, ChecklistProgress>;
  allLabels: ParsedLabel[];
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
  projectId: string;
}

export default function KanbanColumn({
  column,
  cards,
  groups,
  cardsByGroup,
  density,
  width,
  onCardClick,
  onCardDuplicate,
  onCardRequestDelete,
  collapsedGroupIds,
  onToggleGroupCollapsed,
  onRename,
  onColumnMenu,
  collapsed,
  onToggleCollapsed,
  cardsWithSubKanban, onRenameGroup, onRequestDeleteGroup, onAddCardToGroup, checklistProgress,
  allLabels, onUpdateCardLabels,
  onUpdateCardDueDate,
  onUpdateCardTitle,
  onUpdateCardColor,
  selectedCardIds,
  onCardSelectToggle,
  onBulkDelete,
  onBulkSetColor,
  onBulkToggleLabel,
  onDuplicateMultiple,
  onUpdateCoverPath,
  onReorderGroupCards,
  projectId
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
  const { clusters, loose } = useMemo(() => clusterCardsByGroupLabel(cards), [cards]);

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
            <SortableContext
              items={[...groups.map((g) => `group:${g.id}`), ...cards.map((c) => `card:${c.id}`)]}
              strategy={verticalListSortingStrategy}
            >
              {groups.map((g) => (
                <GroupBlock
                  key={g.id}
                  group={g}
                  cards={cardsByGroup.get(g.id) ?? []}
                  density={density}
                  cardsWithSubKanban={cardsWithSubKanban}
                  collapsed={collapsedGroupIds.has(g.id)}
                  onToggleCollapsed={() => onToggleGroupCollapsed(g.id)}
                  onCardClick={onCardClick}
                  onCardDuplicate={onCardDuplicate}
                  onCardRequestDelete={onCardRequestDelete}
                  selectedCardIds={selectedCardIds}
                  onCardSelectToggle={onCardSelectToggle}
                  onBulkDelete={onBulkDelete}
                  onBulkSetColor={onBulkSetColor}
                  onBulkToggleLabel={onBulkToggleLabel}
                  onRename={(name) => onRenameGroup(g.id, name)}
                  onRequestDelete={() => onRequestDeleteGroup(g.id)}
                  onAddCard={(title) => onAddCardToGroup(g.id, title)}
                  onReorderGroupCards={onReorderGroupCards}
                  allLabels={allLabels}
                  onUpdateCardLabels={onUpdateCardLabels}
                  checklistProgress={checklistProgress}
                  onUpdateCardDueDate={onUpdateCardDueDate}
                  onUpdateCardTitle={onUpdateCardTitle}
                  onUpdateCardColor={onUpdateCardColor}
                  onDuplicateMultiple={onDuplicateMultiple}
                  onUpdateCoverPath={onUpdateCoverPath}
                  projectId={projectId}
                />
              ))}

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
                  scopeType="column"
                  scopeId={column.id}
                  onCardClick={onCardClick}
                  onCardDuplicate={onCardDuplicate}
                  onCardRequestDelete={onCardRequestDelete}
                  selectedCardIds={selectedCardIds}
                  onCardSelectToggle={onCardSelectToggle}
                  onBulkDelete={onBulkDelete}
                  onBulkSetColor={onBulkSetColor}
                  onBulkToggleLabel={onBulkToggleLabel}
                  onUpdateCardLabels={onUpdateCardLabels}
                  onUpdateCardDueDate={onUpdateCardDueDate}
                  onUpdateCardTitle={onUpdateCardTitle}
                  onUpdateCardColor={onUpdateCardColor}
                  onDuplicateMultiple={onDuplicateMultiple}
                  onUpdateCoverPath={onUpdateCoverPath}
                  projectId={projectId}
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
                  selectedCardIds={selectedCardIds}
                  onCardSelectToggle={onCardSelectToggle}
                  onBulkDelete={onBulkDelete}
                  onBulkSetColor={onBulkSetColor}
                  onBulkToggleLabel={onBulkToggleLabel}
                  allLabels={allLabels}
                  onUpdateLabels={onUpdateCardLabels}
                  onUpdateCardDueDate={onUpdateCardDueDate}
                  onUpdateTitle={onUpdateCardTitle}
                  onUpdateColor={onUpdateCardColor}
                  onDuplicateMultiple={onDuplicateMultiple}
                  onUpdateCoverPath={onUpdateCoverPath}
                  projectId={projectId}
                />
              ))}
            </SortableContext>
          </div>
        )}
      </div>
    </div>
  );
}
