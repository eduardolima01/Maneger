import { useMemo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import ImageUploadField from '@/components/ImageUploadField';
import KanbanCard from './KanbanCard';

import type {
  KanbanColumn as ColumnType,
  KanbanCard as CardType,
  KanbanDensity,
  KanbanCardGroup,
  ChecklistProgress,
  UpdateKanbanCardGroupInput
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
  onCreateSubgroup: (parentGroupId: string, name: string) => void;
  onUpdateGroupAppearance: (groupId: string, input: UpdateKanbanCardGroupInput) => void;
  groupsByParent: Map<string, KanbanCardGroup[]>;
  groupHeights: Record<string, number>;
  onResizeGroupHeight: (groupId: string, height: number) => void;
  onReorderGroupCards: (orderedIds: string[]) => void;
  checklistProgress: Record<string, ChecklistProgress>;
  allLabels: ParsedLabel[];
  onUpdateCardLabels: (cardId: string, labels: string[]) => void;
  onUpdateCardDueDate: (cardId: string, dueDate: string | null) => void;
  onUpdateCardTitle: (cardId: string, title: string) => void;
  onUpdateCardColor: (cardId: string, color: string | null) => void;
  onDuplicateMultiple: (cardId: string, mode: DuplicateMultipleMode) => void;
  onUpdateCoverPath: (cardId: string, path: string) => void
  onUpdateColumnCover: (path: string | null) => void;
  onResizeColumnWidth: (width: number) => void;
  onArchive: () => void;

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
  cardsWithSubKanban, onRenameGroup, onRequestDeleteGroup, onAddCardToGroup, onCreateSubgroup,
  onUpdateGroupAppearance,
  groupsByParent, groupHeights, onResizeGroupHeight, checklistProgress,
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
  onUpdateColumnCover,
  onResizeColumnWidth,
  onArchive,
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
  const [showCoverEditor, setShowCoverEditor] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);

  const MIN_COLUMN_WIDTH = 120;

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = width;
    let finalWidth = width;

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - startX;
      finalWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + delta);
      setLiveWidth(finalWidth);
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      onResizeColumnWidth(finalWidth);
      setLiveWidth(null);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: liveWidth ?? width,
    flexShrink: 0,
    position: 'relative',
  };

  const overLimit = column.wipLimit !== null && cards.length > column.wipLimit;
  const { clusters, loose } = useMemo(() => clusterCardsByGroupLabel(cards), [cards]);

  return (
    <div ref={setSortableRef} style={style}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#ffffff', borderRadius: 8, padding: 8 }}>
        {column.coverPath && (
          <div style={{ position: 'relative' }}>
            <img
              src={convertFileSrc(column.coverPath)}
              alt=""
              style={{
                width: 'calc(100% + 16px)',
                margin: '-8px -8px 8px -8px',
                height: 64,
                objectFit: 'cover',
                borderRadius: '8px 8px 0 0',
                display: 'block',
              }}
            />
            <button
              onClick={() => setShowCoverEditor((v) => !v)}
              title="Editar capa"
              style={{
                position: 'absolute', top: 4, right: 4, border: 'none', borderRadius: 4,
                backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff', cursor: 'pointer',
                fontSize: 11, padding: '2px 5px',
              }}
            >
              🖼️
            </button>
          </div>
        )}
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
          {!column.coverPath && (
            <button
              onClick={() => setShowCoverEditor((v) => !v)}
              title="Adicionar capa"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, opacity: 0.4 }}
            >
              🖼️
            </button>
          )}
          <button onClick={onColumnMenu} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>⋮</button>
          <button
            onClick={onArchive}
            title={column.visible ? 'Arquivar coluna' : 'Restaurar coluna'}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: column.visible ? '#999' : '#1a73e8' }}
          >
            {column.visible ? '🗄' : '↩'}
          </button>
        </div>

        {showCoverEditor && (
          <div style={{ marginBottom: 8, padding: 6, backgroundColor: '#fff', borderRadius: 6, border: '1px dashed #ccc', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ImageUploadField
              entityId={column.id}
              currentPath={column.coverPath}
              onUploaded={(path) => { onUpdateColumnCover(path); setShowCoverEditor(false); }}
              height={70}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {column.coverPath ? (
                <button
                  onClick={() => { onUpdateColumnCover(null); setShowCoverEditor(false); }}
                  style={{ fontSize: 11, color: '#c62828', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Remover capa
                </button>
              ) : <span />}
              <button
                onClick={() => setShowCoverEditor(false)}
                style={{ fontSize: 11, color: '#666', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Fechar
              </button>
            </div>
          </div>
        )}

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
                  cardsByGroup={cardsByGroup}
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
                  onRenameGroup={onRenameGroup}
                  onRequestDeleteGroup={onRequestDeleteGroup}
                  onAddCardToGroup={onAddCardToGroup}
                  onCreateSubgroup={onCreateSubgroup}
                  onUpdateGroupAppearance={onUpdateGroupAppearance}
                  onReorderGroupCards={onReorderGroupCards}
                  groupsByParent={groupsByParent}
                  groupHeights={groupHeights}
                  onResizeGroupHeight={onResizeGroupHeight}
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

      <div
        onMouseDown={handleResizeMouseDown}
        title="Arrastar pra redimensionar"
        style={{
          position: 'absolute', top: 0, right: -3, bottom: 0, width: 6,
          cursor: 'col-resize', zIndex: 1,
        }}
      />
    </div>
  );
}
