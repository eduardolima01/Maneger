import { useMemo, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { convertFileSrc } from '@tauri-apps/api/core';
import KanbanCard from './KanbanCard';
import type { KanbanCardGroup, KanbanCard as CardType, KanbanDensity, ChecklistProgress, TaskPriority, UpdateKanbanCardGroupInput } from '@/types/kanban.types';
import { clusterCardsByGroupLabel, ParsedLabel } from '@/Kanban/utils/kanbanLabels';
import LabelGroupBlock from '@/Kanban/utils/LabelGroupBlock';
import { DuplicateMultipleMode } from '@/Kanban/components/DuplicateMenu';
import ContextMenu from '@/components/ui/ContextMenu';
import ImageUploadField from '@/components/ImageUploadField';

const GROUP_BG_COLORS = ['#f5f5f5', '#fce4ec', '#e3f2fd', '#e8f5e9', '#fff3e0', '#f3e5f5'];
const LOGO_SIZE = 60;

interface GroupBlockProps {
  group: KanbanCardGroup;
  cards: CardType[];
  density: KanbanDensity;
  cardsWithSubKanban: Set<string>;
  collapsed: boolean;
  checklistProgress: Record<string, ChecklistProgress>;
  allLabels: ParsedLabel[];
  onToggleCollapsed: () => void;
  onCardClick: (cardId: string, focusDescription?: boolean) => void;
  onCardDuplicate: (cardId: string) => void;
  onCardRequestDelete: (cardId: string, title: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onRequestDeleteGroup: (groupId: string) => void;
  onAddCardToGroup: (groupId: string, title: string) => void;
  onCreateSubgroup: (parentGroupId: string, name: string) => void;
  onUpdateCardLabels: (cardId: string, labels: string[]) => void;
  onReorderGroupCards: (orderedIds: string[]) => void;
  onUpdateCardDueDate: (cardId: string, dueDate: string | null) => void;
  onUpdateCardTitle: (cardId: string, title: string) => void;
  onUpdateCardColor: (cardId: string, color: string | null) => void;
  onDuplicateMultiple: (cardId: string, mode: DuplicateMultipleMode) => void;

  /** Capa, emoji, descrição e/ou cor de fundo do grupo/subgrupo — nome continua em onRenameGroup. */
  onUpdateGroupAppearance: (groupId: string, input: UpdateKanbanCardGroupInput) => void;

  /** Todos os grupos do kanban (não só os deste bloco) — usado pra achar os filhos deste grupo. */
  groupsByParent: Map<string, KanbanCardGroup[]>;
  /** Cards de QUALQUER grupo (incluindo subgrupos), pra montar os cards de cada filho ao renderizar recursivamente. */
  cardsByGroup: Map<string, CardType[]>;
  /** Alturas customizadas por grupo (viewPrefs.groupHeights), pra manter o redimensionamento também nos filhos. */
  groupHeights: Record<string, number>;
  onResizeGroupHeight: (groupId: string, height: number) => void;

  selectedCardIds: Set<string>;
  onCardSelectToggle: (cardId: string) => void;
  onBulkDelete: (cardIds: string[]) => void;
  onBulkSetColor: (cardIds: string[], color: string | null) => void;
  onBulkToggleLabel: (cardIds: string[], name: string, color: string, isGroup: boolean) => void;
  onUpdateCoverPath: (cardId: string, path: string) => void
  projectId: string;
}

const DEFAULT_GROUP_HEIGHT = 320;
const MIN_GROUP_HEIGHT = 80;

export default function GroupBlock({
  group, cards, density, cardsWithSubKanban, collapsed, onToggleCollapsed, onCardClick, onCardDuplicate, onCardRequestDelete,
  onRenameGroup, onRequestDeleteGroup, onAddCardToGroup, onCreateSubgroup,
  allLabels, onUpdateCardLabels, checklistProgress,
  onReorderGroupCards,
  onUpdateCardDueDate, onUpdateCardTitle, onUpdateCardColor,
  onUpdateGroupAppearance,
  groupsByParent, cardsByGroup, groupHeights, onResizeGroupHeight,
  selectedCardIds,
  onCardSelectToggle,
  onBulkDelete,
  onBulkSetColor,
  onBulkToggleLabel,
  onDuplicateMultiple,
  onUpdateCoverPath,
  projectId
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
  const [sortMenu, setSortMenu] = useState<{ x: number; y: number } | null>(null);

  const [addingSubgroup, setAddingSubgroup] = useState(false);
  const [newSubgroupName, setNewSubgroupName] = useState('');
  const [liveHeight, setLiveHeight] = useState<number | null>(null);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(group.description ?? '');
  const childGroups = (groupsByParent.get(group.id) ?? []).sort((a, b) => a.position - b.position);
  const contentHeight = liveHeight ?? groupHeights[group.id] ?? DEFAULT_GROUP_HEIGHT;

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = contentHeight;
    let finalHeight = contentHeight;

    function onMove(ev: MouseEvent) {
      const delta = ev.clientY - startY;
      finalHeight = Math.max(MIN_GROUP_HEIGHT, startHeight + delta);
      setLiveHeight(finalHeight);
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      onResizeGroupHeight(group.id, finalHeight);
      setLiveHeight(null);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function submitNewSubgroup() {
    if (!newSubgroupName.trim()) { setAddingSubgroup(false); return; }
    onCreateSubgroup(group.id, newSubgroupName.trim());
    setNewSubgroupName('');
    setAddingSubgroup(false);
  }

  function handleEditEmoji() {
    const next = window.prompt('Emoji do grupo (deixe vazio pra remover):', group.emoji ?? '');
    if (next !== null) onUpdateGroupAppearance(group.id, { emoji: next.trim() || null });
  }

  function submitDescription() {
    const trimmed = descriptionDraft.trim();
    if (trimmed !== (group.description ?? '')) {
      onUpdateGroupAppearance(group.id, { description: trimmed || null });
    }
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
  };

  async function submitNewCard() {
    const lines = newCardTitle.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { setAddingCard(false); return; }
    for (const line of lines) {
      onAddCardToGroup(group.id, line); // sequencial: evita colisão de posição entre criações simultâneas
    }
    setNewCardTitle('');
    newCardInputRef.current?.focus(); // mantém o input focado — permite criar vários em sequência
  }

  const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

  function sortBy(criterion: 'title' | 'startDate' | 'dueDate' | 'priority' | 'createdAt') {
    const sorted = [...cards].sort((a, b) => {
      if (criterion === 'startDate') {
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return a.startDate.localeCompare(b.startDate);
      } if (criterion === 'title') return a.title.localeCompare(b.title);
      if (criterion === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (criterion === 'createdAt') return a.createdAt.localeCompare(b.createdAt);
      const pa = a.priority ? PRIORITY_ORDER[a.priority] : 4;
      const pb = b.priority ? PRIORITY_ORDER[b.priority] : 4;
      return pa - pb;
    });
    onReorderGroupCards(sorted.map((c) => c.id));
    setSortMenu(null);
  }
  return (
    <div ref={setSortableRef} style={{ ...style, marginBottom: 8 }}>
      <div ref={setDroppableRef} style={{ position: 'relative', border: '2px dashed #c7c7c7', borderRadius: 6, padding: 6, backgroundColor: isOver ? '#e8f0fe' : (group.backgroundColor ?? '#f5f5f5') }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <span {...attributes} {...listeners} style={{ color: '#999', fontSize: 11, cursor: 'grab', touchAction: 'none' }} title="Arrastar grupo">⠿</span>
          <button
            onClick={onToggleCollapsed}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, color: '#666', padding: 0 }}
          >
            {collapsed ? '▶' : '▼'}
          </button>

          {group.coverPath ? (
            <img
              src={convertFileSrc(group.coverPath)}
              alt=""
              onClick={() => setAppearanceOpen((v) => !v)}
              title="Capa do grupo (clique pra editar)"
              style={{ width: LOGO_SIZE, height: LOGO_SIZE, objectFit: 'cover', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
            />
          ) : (
            <span
              onClick={handleEditEmoji}
              style={{ cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
              title="Emoji do grupo"
            >
              {group.emoji || '🏷️'}
            </span>
          )}

          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => nameDraft.trim() && nameDraft !== group.name && onRenameGroup(group.id, nameDraft.trim())}
            style={{ flex: 1, fontSize: 12, fontWeight: 600, border: 'none', background: 'none', outline: 'none' }}
          />
          <span style={{ fontSize: 10, color: '#999' }}>({cards.length})</span>
          <button
            onClick={() => setAppearanceOpen((v) => !v)}
            title="Aparência do grupo"
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: appearanceOpen ? '#1a73e8' : '#666', fontSize: 12 }}
          >
            🎨
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setSortMenu({ x: e.clientX, y: e.clientY }); }}
            title="Ordenar cards do grupo"
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#666', fontSize: 12 }}
          >
            ↕
          </button>
          <button onClick={() => onRequestDeleteGroup(group.id)} title="Desagrupar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 11 }}>✕</button>
        </div>

        {appearanceOpen && (
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, padding: 8, marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ImageUploadField
              entityId={group.id}
              currentPath={group.coverPath}
              onUploaded={(path) => onUpdateGroupAppearance(group.id, { coverPath: path })}
              height={LOGO_SIZE}
            />
            {group.coverPath && (
              <button
                onClick={() => onUpdateGroupAppearance(group.id, { coverPath: null })}
                style={{ fontSize: 11, color: '#c62828', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
              >
                Remover capa
              </button>
            )}
            <textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              onBlur={submitDescription}
              placeholder="Descrição do grupo..."
              rows={2}
              style={{ fontSize: 11, padding: 4, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              {GROUP_BG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdateGroupAppearance(group.id, { backgroundColor: c })}
                  title={c}
                  style={{
                    width: 18, height: 18, borderRadius: 4, background: c, cursor: 'pointer', padding: 0,
                    border: group.backgroundColor === c ? '2px solid #1a73e8' : '1px solid #ccc',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {group.description && !appearanceOpen && (
          <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>{group.description}</div>
        )}

        <div style={{ minHeight: 30, height: collapsed ? undefined : contentHeight, overflowY: 'auto' }}>

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
                  onUpdateCoverPath={onUpdateCoverPath}

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
                  projectId={projectId}
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

          {!collapsed && childGroups.length > 0 && (
            <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: '2px solid #ddd', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {childGroups.map((child) => (
                <GroupBlock
                  key={child.id}
                  group={child}
                  cards={cardsByGroup.get(child.id) ?? []}
                  density={density}
                  cardsWithSubKanban={cardsWithSubKanban}
                  collapsed={false}
                  onToggleCollapsed={() => { }}
                  checklistProgress={checklistProgress}
                  allLabels={allLabels}
                  onCardClick={onCardClick}
                  onCardDuplicate={onCardDuplicate}
                  onCardRequestDelete={onCardRequestDelete}
                  onRenameGroup={onRenameGroup}
                  onRequestDeleteGroup={onRequestDeleteGroup}
                  onAddCardToGroup={onAddCardToGroup}
                  onCreateSubgroup={onCreateSubgroup}
                  onUpdateCardLabels={onUpdateCardLabels}
                  onReorderGroupCards={onReorderGroupCards}
                  onUpdateCardDueDate={onUpdateCardDueDate}
                  onUpdateCardTitle={onUpdateCardTitle}
                  onUpdateCardColor={onUpdateCardColor}
                  onDuplicateMultiple={onDuplicateMultiple}
                  onUpdateGroupAppearance={onUpdateGroupAppearance}
                  groupsByParent={groupsByParent}
                  cardsByGroup={cardsByGroup}
                  groupHeights={groupHeights}
                  onResizeGroupHeight={onResizeGroupHeight}
                  selectedCardIds={selectedCardIds}
                  onCardSelectToggle={onCardSelectToggle}
                  onBulkDelete={onBulkDelete}
                  onBulkSetColor={onBulkSetColor}
                  onBulkToggleLabel={onBulkToggleLabel}
                  onUpdateCoverPath={onUpdateCoverPath}
                  projectId={projectId}
                />
              ))}
            </div>
          )}

          {!collapsed && (
            addingSubgroup ? (
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <input
                  autoFocus
                  value={newSubgroupName}
                  onChange={(e) => setNewSubgroupName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitNewSubgroup()}
                  onBlur={submitNewSubgroup}
                  placeholder="Nome do subgrupo..."
                  style={{ flex: 1, fontSize: 11, padding: 5 }}
                />
              </div>
            ) : (
              <button
                onClick={() => setAddingSubgroup(true)}
                style={{ width: '100%', textAlign: 'left', fontSize: 11, color: '#7c7c7c', border: 'none', background: 'none', cursor: 'pointer', padding: '4px 2px', marginTop: 4 }}
              >
                + Subgrupo
              </button>
            )
          )}
        </div>
      </div>

      {!collapsed && (
        <div
          onMouseDown={handleResizeMouseDown}
          title="Arrastar pra redimensionar"
          style={{
            position: 'absolute', left: 0, right: 0, bottom: -3, height: 6,
            cursor: 'row-resize', zIndex: 1,
          }}
        />
      )}

      {sortMenu && (
        <ContextMenu
          x={sortMenu.x}
          y={sortMenu.y}
          onClose={() => setSortMenu(null)}
          items={[
            { label: 'Ordenar por Título (A-Z)', onClick: () => sortBy('title') },
            { label: 'Ordenar por Data de início', onClick: () => sortBy('startDate') },
            { label: 'Ordenar por Prazo', onClick: () => sortBy('dueDate') },
            { label: 'Ordenar por Prioridade', onClick: () => sortBy('priority') },
            { label: 'Ordenar por Data de criação', onClick: () => sortBy('createdAt') },
          ]}
        />
      )}
    </div>
  );
}
