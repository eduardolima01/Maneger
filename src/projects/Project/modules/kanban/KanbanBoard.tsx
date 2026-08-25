import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import KanbanColumn from './KanbanColumn';
import KanbanToolbar from './KanbanToolbar';
import KanbanColumnSettingsModal from './KanbanColumnSettingsModal';
import KanbanCardModal from './KanbanCardModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useKanbanBoard } from '@/lib/hooks/useKanbanBoard';
import type { Kanban } from '@/types/kanban.types';
import { clearGroupLabels, ParsedLabel, parseLabel, setSingleGroupLabel } from '@/Kanban/utils/kanbanLabels';
import LabelManagerModal from './LabelManagerModal';
import Button from '@/components/layout/Button';
import KanbanGenerateCardsModal from '@/Kanban/components/KanbanGenerateCardsModal';

interface KanbanBoardProps {
  kanban: Kanban;
}

const DEFAULT_COLUMN_WIDTH = 280;
const EMPTY_COLUMN_WIDTH = 160;

export default function KanbanBoard({ kanban }: KanbanBoardProps) {

  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<string | null>(null);
  const [newCardColumnId, setNewCardColumnId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newGroupColumnId, setNewGroupColumnId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const newGroupInputRef = useRef<HTMLInputElement>(null);
  const newCardInputRef = useRef<HTMLTextAreaElement>(null);
  const board = useKanbanBoard(kanban);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectionBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const visibleColumns = board.columns.filter((c) => c.visible);
  const allLabels = Array.from(new Set(board.cards.flatMap((c) => c.labels)));

  const allParsedLabels: ParsedLabel[] = useMemo(() => {
    const map = new Map<string, { color: string; isGroup: boolean }>();
    for (const raw of board.cards.flatMap((c) => c.labels)) {
      const { name, color, isGroup } = parseLabel(raw);
      const existing = map.get(name);
      if (!existing) {
        map.set(name, { color, isGroup });
      } else if (isGroup && !existing.isGroup) {
        // se QUALQUER ocorrência do nome for "de grupo", trata a etiqueta como de grupo
        // (mesmo critério usado em fixInconsistentGroupLabels — evita mostrar desmarcado por causa de uma ocorrência antiga não corrigida)
        map.set(name, { color: existing.color, isGroup: true });
      }
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, color: v.color, isGroup: v.isGroup }));
  }, [board.cards]);

  const labelCardCounts: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const raw of board.cards.flatMap((c) => c.labels)) {
      const { name } = parseLabel(raw);
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  }, [board.cards]);
  const collapsedIds = new Set(board.viewPrefs.collapsedColumnIds);
  const collapsedGroupIds = new Set(board.viewPrefs.collapsedGroupIds);
  const selectedCard = selectedCardId ? board.cards.find((c) => c.id === selectedCardId) ?? null : null;

  function toggleCardSelection(cardId: string) {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId);
      return next;
    });
  }

  const handleSelectionMouseMove = useCallback((e: MouseEvent) => {
    const start = selectionStartRef.current;
    if (!start) return;
    const box = {
      x: Math.min(start.x, e.clientX),
      y: Math.min(start.y, e.clientY),
      width: Math.abs(e.clientX - start.x),
      height: Math.abs(e.clientY - start.y),
    };
    selectionBoxRef.current = box;
    setSelectionBox(box);
  }, []);

  const handleSelectionMouseUp = useCallback(() => {
    window.removeEventListener('mousemove', handleSelectionMouseMove);
    window.removeEventListener('mouseup', handleSelectionMouseUp);
    const box = selectionBoxRef.current;
    selectionStartRef.current = null;
    selectionBoxRef.current = null;
    setSelectionBox(null);
    if (!box || (box.width < 4 && box.height < 4)) return; // arrasto mínimo — evita disparo em Ctrl+clique sem arrastar

    const cardEls = boardContainerRef.current?.querySelectorAll<HTMLElement>('[data-kanban-card]');
    if (!cardEls) return;
    const boxRight = box.x + box.width;
    const boxBottom = box.y + box.height;
    const hitIds: string[] = [];
    cardEls.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.left < boxRight && r.right > box.x && r.top < boxBottom && r.bottom > box.y) {
        const id = el.getAttribute('data-kanban-card');
        if (id) hitIds.push(id);
      }
    });
    if (hitIds.length === 0) return;
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      for (const id of hitIds) {
        if (next.has(id)) next.delete(id); else next.add(id);
      }
      return next;
    });
  }, [handleSelectionMouseMove]);

  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-kanban-card], button, input, textarea, select')) return; // clique em card/controle já tem seu próprio handler
    e.preventDefault();
    selectionStartRef.current = { x: e.clientX, y: e.clientY };
    setSelectionBox({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
    window.addEventListener('mousemove', handleSelectionMouseMove);
    window.addEventListener('mouseup', handleSelectionMouseUp);
  }, [handleSelectionMouseMove, handleSelectionMouseUp]);

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleSelectionMouseMove);
      window.removeEventListener('mouseup', handleSelectionMouseUp);
    };
  }, [handleSelectionMouseMove, handleSelectionMouseUp]);
  function handleCardClick(cardId: string) {
    setSelectedCardIds(new Set()); // clique normal sai do modo seleção múltipla
    setSelectedCardId(cardId);
  }


  async function handleCreateGroup() {
    if (!newGroupColumnId || !newGroupName.trim()) return;
    await board.createGroup(newGroupColumnId, newGroupName.trim());
    setNewGroupName('');
    newGroupInputRef.current?.focus(); // mesmo padrão do card: mantém aberto pra criar vários em sequência
  }

  function toggleColumnCollapsed(columnId: string) {
    const next = collapsedIds.has(columnId)
      ? board.viewPrefs.collapsedColumnIds.filter((id) => id !== columnId)
      : [...board.viewPrefs.collapsedColumnIds, columnId];
    board.saveViewPrefs({ collapsedColumnIds: next });
  }


  function toggleGroupCollapsed(groupId: string) {
    const next = collapsedGroupIds.has(groupId)
      ? board.viewPrefs.collapsedGroupIds.filter((id) => id !== groupId)
      : [...board.viewPrefs.collapsedGroupIds, groupId];
    board.saveViewPrefs({ collapsedGroupIds: next });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === 'column') {
      if (active.id === over.id) return;
      const ids = visibleColumns.map((c) => c.id);
      const fromIndex = ids.indexOf(active.id as string);
      const toIndex = ids.indexOf(over.id as string);
      if (fromIndex === -1 || toIndex === -1) return;
      board.reorderColumns(arrayMove(ids, fromIndex, toIndex));
      return;
    }

    if (activeType === 'group') {
      const groupId = activeId.replace('group:', '');
      const targetColumnId =
        (over.data.current?.type === 'column' && (over.data.current?.columnId as string)) ||
        findColumnOfSortableItem(overId);
      if (!targetColumnId) return;

      const itemsInTarget = combinedItemIdsForColumn(targetColumnId).filter((id) => id !== activeId);
      const overIndex = itemsInTarget.indexOf(overId);
      if (overIndex !== -1) itemsInTarget.splice(overIndex, 0, activeId);
      else itemsInTarget.push(activeId);

      board.moveGroupToColumn(groupId, targetColumnId, itemsInTarget.map(stripPrefix));
      return;
    }

    if (activeType === 'card') {
      const cardId = activeId.replace('card:', '');
      const activeCard = board.cards.find((c) => c.id === cardId);

      // resolve pra onde estruturalmente o card vai (grupo manual ou coluna solta) e, se for o caso,
      // qual etiqueta de subgrupo o alvo representa (pra sincronizar a etiqueta do card com o destino)
      let targetKind: 'group' | 'column' | null = null;
      let targetScopeId: string | null = null;
      let targetLabel: { name: string; color: string } | null = null;

      if (overType === 'label-group') {
        const data = over.data.current as { scopeType: 'group' | 'column'; scopeId: string; labelName: string; labelColor: string };
        targetKind = data.scopeType;
        targetScopeId = data.scopeId;
        targetLabel = { name: data.labelName, color: data.labelColor };
      } else if (overType === 'group') {
        targetKind = 'group';
        targetScopeId = over.data.current?.groupId as string;
      } else if (overId.startsWith('card:')) {
        const overCardId = overId.replace('card:', '');
        const overCard = board.cards.find((c) => c.id === overCardId);
        if (overCard) {
          if (overCard.cardGroupId) {
            targetKind = 'group';
            targetScopeId = overCard.cardGroupId;
          } else if (overCard.columnId) {
            targetKind = 'column';
            targetScopeId = overCard.columnId;
          }
          const overGroupLabel = overCard.labels
            .map(parseLabel)
            .filter((l) => l.isGroup)
            .sort((a, b) => a.name.localeCompare(b.name))[0];
          if (overGroupLabel) targetLabel = { name: overGroupLabel.name, color: overGroupLabel.color };
        }
      } else {
        const columnId =
          (over.data.current?.type === 'column' && (over.data.current?.columnId as string)) ||
          findColumnOfSortableItem(overId);
        if (columnId) { targetKind = 'column'; targetScopeId = columnId; }
      }

      if (!targetKind || !targetScopeId) return;

      const isMultiMove = selectedCardIds.has(cardId) && selectedCardIds.size > 1;
      if (isMultiMove) {
        const movingIds = board.cards
          .filter((c) => selectedCardIds.has(c.id))
          .sort((a, b) => a.position - b.position)
          .map((c) => c.id);

        const existingScopeCards = targetKind === 'group'
          ? (board.cardsByGroup.get(targetScopeId) ?? [])
          : (board.ungroupedCardsByColumn.get(targetScopeId) ?? []);
        const existingIds = existingScopeCards.map((c) => c.id).filter((id) => !selectedCardIds.has(id));
        const overIndex = overId.startsWith('card:') ? existingIds.indexOf(overId.replace('card:', '')) : -1;
        const finalOrder = overIndex !== -1
          ? [...existingIds.slice(0, overIndex), ...movingIds, ...existingIds.slice(overIndex)]
          : [...existingIds, ...movingIds];

        await board.bulkMoveCards(
          movingIds,
          targetKind === 'group' ? { kind: 'group', groupId: targetScopeId } : { kind: 'column', columnId: targetScopeId },
          finalOrder
        );

        await Promise.all(movingIds.map((id) => {
          const c = board.cards.find((cc) => cc.id === id);
          if (!c) return Promise.resolve();
          const nextLabels = targetLabel ? setSingleGroupLabel(c.labels, targetLabel.name, targetLabel.color) : clearGroupLabels(c.labels);
          if (nextLabels.length === c.labels.length && nextLabels.every((l, i) => l === c.labels[i])) return Promise.resolve();
          return board.updateCard(id, { labels: nextLabels });
        }));
        return;
      }

      // Alt segurado = duplicar em vez de mover. O card original nunca é tocado;
      // criamos o duplicado e aplicamos nele toda a lógica de posicionamento abaixo.
      const isDuplicating = altPressedRef.current;
      const effectiveCardId = isDuplicating ? await board.duplicateCard(cardId) : cardId;

      if (targetKind === 'group') {
        const cardsInGroup = (board.cardsByGroup.get(targetScopeId) ?? [])
          .map((c) => c.id)
          .filter((id) => id !== effectiveCardId);
        const overIndex = overId.startsWith('card:') ? cardsInGroup.indexOf(overId.replace('card:', '')) : -1;
        if (overIndex !== -1) cardsInGroup.splice(overIndex, 0, effectiveCardId); else cardsInGroup.push(effectiveCardId);
        board.moveCardIntoGroup(effectiveCardId, targetScopeId, cardsInGroup);
      } else {
        const cardsInTarget = (board.ungroupedCardsByColumn.get(targetScopeId) ?? [])
          .map((c) => c.id)
          .filter((id) => id !== effectiveCardId);
        const overIndex = overId.startsWith('card:') ? cardsInTarget.indexOf(overId.replace('card:', '')) : -1;
        if (overIndex !== -1) cardsInTarget.splice(overIndex, 0, effectiveCardId); else cardsInTarget.push(effectiveCardId);

        if (!isDuplicating && activeCard?.cardGroupId) {
          board.moveCardOutOfGroup(cardId, targetScopeId, cardsInTarget);
        } else {
          board.moveCard(effectiveCardId, targetScopeId, cardsInTarget);
        }
      }

      // sincroniza a etiqueta de grupo: entrou num subgrupo → recebe a etiqueta; saiu de qualquer subgrupo → perde a etiqueta
      if (activeCard) {
        const nextLabels = targetLabel
          ? setSingleGroupLabel(activeCard.labels, targetLabel.name, targetLabel.color)
          : clearGroupLabels(activeCard.labels);
        const changed = nextLabels.length !== activeCard.labels.length || nextLabels.some((l, i) => l !== activeCard.labels[i]);
        if (changed) board.updateCard(effectiveCardId, { labels: nextLabels });
      }
    }
  }

  function findColumnOfSortableItem(id: string): string | undefined {
    if (id.startsWith('card:')) {
      const cardId = id.replace('card:', '');
      return board.cards.find((c) => c.id === cardId && c.columnId)?.columnId ?? undefined;
    }
    if (id.startsWith('group:')) {
      const groupId = id.replace('group:', '');
      return board.groups.find((g) => g.id === groupId)?.columnId;
    }
    return undefined;
  }


  function combinedItemIdsForColumn(columnId: string): string[] {
    const groupIds = (board.groupsByColumn.get(columnId) ?? []).map((g) => `group:${g.id}`);
    const cardIds = (board.ungroupedCardsByColumn.get(columnId) ?? []).map((c) => `card:${c.id}`);
    return [...groupIds, ...cardIds];
  }

  function stripPrefix(id: string): string {
    return id.replace('group:', '').replace('card:', '');
  }

  async function handleCreateCard() {
    if (!newCardColumnId) return;
    const lines = newCardTitle.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    for (const line of lines) {
      await board.createCard(newCardColumnId, line); // sequencial: evita colisão de posição entre criações simultâneas
    }
    setNewCardTitle('');
    newCardInputRef.current?.focus();
  }
  const altPressedRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Alt') altPressedRef.current = true; };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Alt') altPressedRef.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (selectedCardIds.size === 0) return;
    function onEscape(e: KeyboardEvent) { if (e.key === 'Escape') setSelectedCardIds(new Set()); }
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [selectedCardIds.size]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <KanbanToolbar
            search={board.search}
            onSearchChange={board.setSearch}
            filters={board.filters}
            onFiltersChange={board.setFilters}
            filtersActive={board.filtersActive}
            availableLabels={allLabels}
            density={board.viewPrefs.density}
            onDensityChange={(density) => board.saveViewPrefs({ density })}
            onOpenColumnSettings={() => setColumnSettingsOpen(true)}
            onOpenLabelManager={() => setLabelManagerOpen(true)}
          />
        </div>
        <Button variant="secondary" onClick={() => setGenerateModalOpen(true)}>+ Gerar cards</Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleColumns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
          <div
            ref={boardContainerRef}
            onMouseDown={handleContainerMouseDown}
            style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'stretch', minHeight: 400 }}
          >
            {visibleColumns.map((col) => (
              <div key={col.id} style={{ display: 'flex', flexDirection: 'column' }}>
                {(() => {
                  const columnCards = board.ungroupedCardsByColumn.get(col.id) ?? [];
                  const columnGroups = board.groupsByColumn.get(col.id) ?? [];
                  const isEmpty = columnCards.length === 0 && columnGroups.length === 0;
                  const customWidth = board.viewPrefs.columnWidths[col.id];
                  const resolvedWidth = customWidth ?? (isEmpty ? EMPTY_COLUMN_WIDTH : DEFAULT_COLUMN_WIDTH);
                  return (
                    <KanbanColumn
                      column={col}
                      cards={columnCards}
                      groups={columnGroups}
                      cardsByGroup={board.cardsByGroup}
                      collapsedGroupIds={collapsedGroupIds}
                      onToggleGroupCollapsed={toggleGroupCollapsed}
                      density={board.viewPrefs.density}
                      width={resolvedWidth}
                      collapsed={collapsedIds.has(col.id)}
                      onToggleCollapsed={() => toggleColumnCollapsed(col.id)}
                      onRename={(name) => board.updateColumn(col.id, { name })}
                      onColumnMenu={() => setColumnSettingsOpen(true)}
                      cardsWithSubKanban={board.cardsWithSubKanban}
                      onCardDuplicate={board.duplicateCard}
                      checklistProgress={board.checklistProgress}
                      onCardRequestDelete={(id, title) => setDeleteTarget({ id, title })}
                      onRenameGroup={board.renameGroup}
                      onRequestDeleteGroup={(groupId) => setDeleteGroupTarget(groupId)}
                      onAddCardToGroup={board.createCardInGroup}
                      allLabels={allParsedLabels}
                      onUpdateCardLabels={(id, labels) => board.updateCard(id, { labels })}
                      onUpdateCardDueDate={(id, dueDate) => board.updateCard(id, { dueDate })}
                      onUpdateCardTitle={(id, title) => board.updateCard(id, { title })}
                      onUpdateCardColor={(id, color) => board.updateCard(id, { color })}
                      onDuplicateMultiple={board.duplicateCardMultiple}
                      onUpdateCoverPath={(id, path) => board.updateCard(id, { coverPath: path })}

                      onCardClick={handleCardClick}
                      selectedCardIds={selectedCardIds}
                      onCardSelectToggle={toggleCardSelection}
                      onBulkDelete={() => setBulkDeleteConfirm(true)}
                      onBulkSetColor={board.bulkSetColor}
                      onBulkToggleLabel={board.bulkToggleLabel}
                    />
                  );
                })()}
                {!collapsedIds.has(col.id) && (
                  newCardColumnId === col.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <textarea
                          ref={newCardInputRef}
                          autoFocus
                          value={newCardTitle}
                          onChange={(e) => setNewCardTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleCreateCard();
                            }
                          }}
                          onBlur={() => !newCardTitle.trim() && setNewCardColumnId(null)}
                          placeholder="Título do card... (Shift+Enter = várias linhas viram vários cards)"
                          rows={2}
                          style={{ flex: 1, padding: 6, fontSize: 12, resize: 'vertical', fontFamily: 'inherit' }}
                        />
                        <button
                          onClick={handleCreateCard}
                          disabled={!newCardTitle.trim()}
                          title="Adicionar card"
                          style={{
                            padding: '6px 10px', fontSize: 12, border: 'none', borderRadius: 4,
                            backgroundColor: newCardTitle.trim() ? '#1a73e8' : '#ccc',
                            color: '#fff', cursor: newCardTitle.trim() ? 'pointer' : 'default',
                          }}
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => { setNewCardColumnId(null); setNewCardTitle(''); }}
                        style={{ fontSize: 11, color: '#666', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                      >
                        ✕ Cancelar
                      </button>
                    </div>

                  ) : (
                    <button
                      onClick={() => setNewCardColumnId(col.id)}
                      style={{ marginTop: 4, padding: '6px', fontSize: 12, color: '#666', background: 'none', border: '1px dashed #ccc', borderRadius: 4, cursor: 'pointer' }}
                    >
                      + Novo card
                    </button>

                  )
                )}

                {!collapsedIds.has(col.id) && !newCardColumnId && (
                  newGroupColumnId === col.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          ref={newGroupInputRef}
                          autoFocus
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                          placeholder="Nome do grupo..."
                          style={{ flex: 1, padding: 6, fontSize: 12 }}
                        />
                        <button
                          onClick={handleCreateGroup}
                          disabled={!newGroupName.trim()}
                          title="Adicionar grupo"
                          style={{
                            padding: '6px 10px', fontSize: 12, border: 'none', borderRadius: 4,
                            backgroundColor: newGroupName.trim() ? '#666' : '#ccc',
                            color: '#fff', cursor: newGroupName.trim() ? 'pointer' : 'default',
                          }}
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => { setNewGroupColumnId(null); setNewGroupName(''); }}
                        style={{ fontSize: 11, color: '#666', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                      >
                        ✕ Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNewGroupColumnId(col.id)}
                      style={{ marginTop: 4, padding: '4px', fontSize: 11, color: '#999', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      + Novo grupo
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {selectionBox && (
        <div
          style={{
            position: 'fixed', left: selectionBox.x, top: selectionBox.y,
            width: selectionBox.width, height: selectionBox.height,
            backgroundColor: 'rgba(26, 115, 232, 0.15)', border: '1px solid #1a73e8',
            zIndex: 999, pointerEvents: 'none',
          }}
        />
      )}

      {visibleColumns.length === 0 && !board.loading && (
        <p style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 24 }}>
          Nenhuma coluna visível. Abra "⚙ Colunas" pra criar ou mostrar alguma.
        </p>
      )}

      <KanbanGenerateCardsModal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        columns={visibleColumns}
        onGenerate={board.createCardsBatch}
      />

      <KanbanColumnSettingsModal
        isOpen={columnSettingsOpen}
        onClose={() => setColumnSettingsOpen(false)}
        columns={board.columns}
        onCreate={board.createColumn}
        onUpdate={board.updateColumn}
        onDuplicate={board.duplicateColumn}
        onDelete={board.removeColumn}
        onReorder={board.reorderColumns}
      />

      <LabelManagerModal
        isOpen={labelManagerOpen}
        onClose={() => setLabelManagerOpen(false)}
        labels={allParsedLabels}
        cardCounts={labelCardCounts}
        onRename={board.renameLabel}
        onDelete={board.deleteLabel}
        onFixInconsistentGroupLabels={board.fixInconsistentGroupLabels}
      />

      <KanbanCardModal
        isOpen={selectedCardId !== null}
        onClose={() => setSelectedCardId(null)}
        card={selectedCard}
        onUpdate={board.updateCard}
        onDuplicate={board.duplicateCard}
        onArchive={board.archiveCard}
        onRequestDelete={(id, title) => setDeleteTarget({ id, title })}
      />

      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        title={`Excluir ${selectedCardIds.size} cards?`}
        message="Esta ação não pode ser desfeita."
        onConfirm={() => {
          board.bulkDeleteCards(Array.from(selectedCardIds));
          setSelectedCardIds(new Set());
          setBulkDeleteConfirm(false);
        }}
        onCancel={() => setBulkDeleteConfirm(false)}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Excluir card?"
        message={`Deseja realmente excluir "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`}
        onConfirm={() => {
          if (deleteTarget) board.removeCard(deleteTarget.id);
          setSelectedCardId(null);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={deleteGroupTarget !== null}
        title="Desagrupar cards?"
        message="O grupo será removido, mas os cards dentro dele voltam soltos pra coluna — nenhum card é apagado."
        confirmLabel="Desagrupar"
        onConfirm={() => {
          if (deleteGroupTarget) {
            const group = board.groups.find((g) => g.id === deleteGroupTarget);
            if (group) board.deleteGroup(group.id, group.columnId);
          }
          setDeleteGroupTarget(null);
        }}
        onCancel={() => setDeleteGroupTarget(null)}
      />
    </div>
  );
}

