import { useMemo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import ImageUploadField from '@/components/ImageUploadField';
import BackgroundColorPicker from '@/Kanban/components/BackgroundColorPicker';
import { readableTextColors } from '@/Kanban/utils/readableColors';
import KanbanCard from './KanbanCard';

import type {
  KanbanColumn as ColumnType,
  KanbanCard as CardType,
  KanbanDensity,
  KanbanCardGroup,
  ChecklistProgress,
  UpdateKanbanCardGroupInput,
  CardVisualFieldConfig
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
  visualConfig: CardVisualFieldConfig[];
  width: number;
  cardsWithSubKanban: Set<string>;
  cardsWithFiles: Set<string>;
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
  onUpdateCardStartDate: (cardId: string, startDate: string | null) => void;
  onUpdateCardDescription: (cardId: string, description: string | null) => void;
  onUpdateCardTitle: (cardId: string, title: string) => void;
  onUpdateCardColor: (cardId: string, color: string | null) => void;
  onUpdateCardStatus: (cardId: string, status: import('@/types/kanban.types').TaskStatus | null) => void;
  onDuplicateMultiple: (cardId: string, mode: DuplicateMultipleMode) => void;
  onUpdateCoverPath: (cardId: string, path: string) => void
  onUpdateColumnCover: (path: string | null) => void;
  onResizeColumnWidth: (width: number) => void;
  onArchive: () => void;
  /** Cor de fundo da coluna (guardada em viewPrefs.columnBackgrounds); null = branco padrão. */
  backgroundColor: string | null;
  onUpdateBackgroundColor: (color: string | null) => void;
  /** Modo foco: a coluna ocupa a largura toda e os grupos se organizam em grade. */
  focused: boolean;
  onToggleFocus: () => void;

  selectedCardIds: Set<string>;
  onCardSelectToggle: (cardId: string) => void;
  onBulkDelete: (cardIds: string[]) => void;
  onBulkSetColor: (cardIds: string[], color: string | null) => void;
  onBulkSetStatus: (cardIds: string[], status: import('@/types/kanban.types').TaskStatus | null) => void;
  onBulkToggleLabel: (cardIds: string[], name: string, color: string, isGroup: boolean) => void;
  projectId: string;
}

export default function KanbanColumn({
  column,
  cards,
  groups,
  cardsByGroup,
  density,
  visualConfig,
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
  cardsWithSubKanban, cardsWithFiles, onRenameGroup, onRequestDeleteGroup, onAddCardToGroup, onCreateSubgroup,
  onUpdateGroupAppearance,
  groupsByParent, groupHeights, onResizeGroupHeight, checklistProgress,
  allLabels, onUpdateCardLabels,
  onUpdateCardDueDate,
  onUpdateCardStartDate,
  onUpdateCardDescription,
  onUpdateCardTitle,
  onUpdateCardColor,
  onUpdateCardStatus,
  selectedCardIds,
  onCardSelectToggle,
  onBulkDelete,
  onBulkSetColor,
  onBulkSetStatus,
  onBulkToggleLabel,
  onDuplicateMultiple,
  onUpdateCoverPath,
  onUpdateColumnCover,
  onResizeColumnWidth,
  onArchive,
  backgroundColor,
  onUpdateBackgroundColor,
  focused,
  onToggleFocus,
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
  const [showColorEditor, setShowColorEditor] = useState(false);
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
    width: focused ? '100%' : (liveWidth ?? width),
    flexShrink: 0,
    position: 'relative',
  };

  const overLimit = column.wipLimit !== null && cards.length > column.wipLimit;
  const tc = readableTextColors(backgroundColor ?? '#ffffff'); // texto do cabeçalho legível sobre a cor de fundo da coluna
  const { clusters, loose } = useMemo(() => clusterCardsByGroupLabel(cards), [cards]);

  return (
    <div ref={setSortableRef} style={style}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: backgroundColor ?? '#ffffff', borderRadius: 8, padding: 8 }}>
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
          <button onClick={onToggleCollapsed} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: tc.secondary }}>
            {collapsed ? '▶' : '▼'}
          </button>
          <span {...attributes} {...listeners} style={{ cursor: 'grab', color: tc.muted, fontSize: 12 }} title="Arrastar">⠿</span>
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
            <span onClick={() => setEditingName(true)} style={{ fontSize: 13, fontWeight: 600, flex: 1, color: column.color ?? tc.text }}>
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
          <button
            onClick={onToggleFocus}
            title={focused ? 'Voltar a todas as colunas' : 'Focar só nesta coluna (grupos e subgrupos em tela cheia)'}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: focused ? tc.accent : tc.secondary }}
          >
            {focused ? '↩' : '🔍'}
          </button>
          <button
            onClick={() => setShowColorEditor((v) => !v)}
            title="Cor de fundo da coluna"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, opacity: backgroundColor ? 1 : 0.4 }}
          >
            🎨
          </button>
          <button onClick={onColumnMenu} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: tc.secondary }}>⋮</button>
          <button
            onClick={onArchive}
            title={column.visible ? 'Arquivar coluna' : 'Restaurar coluna'}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: column.visible ? tc.muted : tc.accent }}
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

        {showColorEditor && (
          <div style={{ marginBottom: 8, padding: 6, backgroundColor: '#fff', borderRadius: 6, border: '1px dashed #ccc', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, color: '#888' }}>Cor de fundo da coluna</div>
            <BackgroundColorPicker
              value={backgroundColor}
              fallbackColor="#ffffff"
              coverPath={column.coverPath}
              onChange={onUpdateBackgroundColor}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowColorEditor(false)}
                style={{ fontSize: 11, color: '#666', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: overLimit ? tc.danger : tc.secondary, marginBottom: 6, display: 'flex', gap: 8 }}>
          <span>{cards.length} card{cards.length !== 1 ? 's' : ''}</span>
          {column.wipLimit !== null && <span>WIP: {cards.length}/{column.wipLimit}</span>}
        </div>

        {!collapsed && (
          <div
            ref={setDroppableRef}
            style={{
              flex: 1, minHeight: 40, borderRadius: 6, backgroundColor: isOver ? '#e8f0fe' : 'transparent', padding: 2,
              ...(focused
                // foco: coluna única ocupando a largura toda (cards de cada grupo continuam em lista vertical,
                // só o bloco do grupo em si passa a ocupar 100% da largura); alignItems 'start' pra cada bloco ter a própria altura
                ? { display: 'grid', gridTemplateColumns: '1fr', gap: 12, alignItems: 'start' }
                : { overflowY: 'auto' }),
            }}
          >
            <SortableContext
              items={[...groups.map((g) => `group:${g.id}`), ...cards.map((c) => `card:${c.id}`)]}
              strategy={focused ? rectSortingStrategy : verticalListSortingStrategy}
            >
              {groups.map((g) => (
                <GroupBlock
                  key={g.id}
                  group={g}
                  cards={cardsByGroup.get(g.id) ?? []}
                  cardsByGroup={cardsByGroup}
                  density={density}
                  visualConfig={visualConfig}
                  cardsWithSubKanban={cardsWithSubKanban}
                  cardsWithFiles={cardsWithFiles}
                  collapsed={collapsedGroupIds.has(g.id)}
                  onToggleCollapsed={() => onToggleGroupCollapsed(g.id)}
                  onCardClick={onCardClick}
                  onCardDuplicate={onCardDuplicate}
                  onCardRequestDelete={onCardRequestDelete}
                  selectedCardIds={selectedCardIds}
                  onCardSelectToggle={onCardSelectToggle}
                  onBulkDelete={onBulkDelete}
                  onBulkSetColor={onBulkSetColor}
                  onBulkSetStatus={onBulkSetStatus}
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
                  onUpdateCardStartDate={onUpdateCardStartDate}
                  onUpdateCardDescription={onUpdateCardDescription}
                  onUpdateCardTitle={onUpdateCardTitle}
                  onUpdateCardColor={onUpdateCardColor}
                  onUpdateCardStatus={onUpdateCardStatus}
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
                  visualConfig={visualConfig}
                  cardsWithSubKanban={cardsWithSubKanban}
                  cardsWithFiles={cardsWithFiles}
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
                  onBulkSetStatus={onBulkSetStatus}
                  onBulkToggleLabel={onBulkToggleLabel}
                  onUpdateCardLabels={onUpdateCardLabels}
                  onUpdateCardDueDate={onUpdateCardDueDate}
                  onUpdateCardStartDate={onUpdateCardStartDate}
                  onUpdateCardDescription={onUpdateCardDescription}
                  onUpdateCardTitle={onUpdateCardTitle}
                  onUpdateCardColor={onUpdateCardColor}
                  onUpdateCardStatus={onUpdateCardStatus}
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
                  visualConfig={visualConfig}
                  hasSubKanban={cardsWithSubKanban.has(c.id)}
                  hasFiles={cardsWithFiles.has(c.id)}
                  checklistProgress={checklistProgress[c.id]}
                  onClick={() => onCardClick(c.id)}
                  onDuplicate={() => onCardDuplicate(c.id)}
                  onRequestDelete={() => onCardRequestDelete(c.id, c.title)}
                  selectedCardIds={selectedCardIds}
                  onCardSelectToggle={onCardSelectToggle}
                  onBulkDelete={onBulkDelete}
                  onBulkSetColor={onBulkSetColor}
                  onBulkSetStatus={onBulkSetStatus}
                  onBulkToggleLabel={onBulkToggleLabel}
                  allLabels={allLabels}
                  onUpdateLabels={onUpdateCardLabels}
                  onUpdateCardDueDate={onUpdateCardDueDate}
                  onUpdateStartDate={onUpdateCardStartDate}
                  onUpdateDescription={onUpdateCardDescription}
                  onUpdateTitle={onUpdateCardTitle}
                  onUpdateColor={onUpdateCardColor}
                  onUpdateStatus={onUpdateCardStatus}
                  onDuplicateMultiple={onDuplicateMultiple}
                  onUpdateCoverPath={onUpdateCoverPath}
                  projectId={projectId}
                />
              ))}
            </SortableContext>
          </div>
        )}
      </div>

      {!focused && (
        <div
          onMouseDown={handleResizeMouseDown}
          title="Arrastar pra redimensionar"
          style={{
            position: 'absolute', top: 0, right: -3, bottom: 0, width: 6,
            cursor: 'col-resize', zIndex: 1,
          }}
        />
      )}
    </div>
  );
}
