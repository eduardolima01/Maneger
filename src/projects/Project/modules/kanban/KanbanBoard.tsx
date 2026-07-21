import { useState } from 'react';
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

interface KanbanBoardProps {
  kanban: Kanban;
}

const DEFAULT_COLUMN_WIDTH = 280;

export default function KanbanBoard({ kanban }: KanbanBoardProps) {
  const board = useKanbanBoard(kanban.id);

  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [newCardColumnId, setNewCardColumnId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const visibleColumns = board.columns.filter((c) => c.visible);
  const allLabels = Array.from(new Set(board.cards.flatMap((c) => c.labels)));
  const collapsedIds = new Set(kanban.viewPrefs.collapsedColumnIds);
  const selectedCard = selectedCardId ? board.cards.find((c) => c.id === selectedCardId) ?? null : null;

  function toggleColumnCollapsed(columnId: string) {
    const next = collapsedIds.has(columnId)
      ? kanban.viewPrefs.collapsedColumnIds.filter((id) => id !== columnId)
      : [...kanban.viewPrefs.collapsedColumnIds, columnId];
    board.saveViewPrefs({ collapsedColumnIds: next });
  }

  function findColumnOfCard(cardId: string): string | undefined {
    return board.cards.find((c) => c.id === cardId)?.columnId;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type;

    if (activeType === 'column') {
      if (active.id === over.id) return;
      const ids = visibleColumns.map((c) => c.id);
      const fromIndex = ids.indexOf(active.id as string);
      const toIndex = ids.indexOf(over.id as string);
      if (fromIndex === -1 || toIndex === -1) return;
      board.reorderColumns(arrayMove(ids, fromIndex, toIndex));
      return;
    }

    if (activeType === 'card') {
      const cardId = active.id as string;
      const targetColumnId = (over.data.current?.columnId as string | undefined) ?? findColumnOfCard(over.id as string) ?? (over.id as string);
      if (!targetColumnId) return;

      const cardsInTarget = board.cardsByColumn.get(targetColumnId) ?? [];
      const orderedIds = cardsInTarget.map((c) => c.id).filter((id) => id !== cardId);

      const overCardIndex = orderedIds.indexOf(over.id as string);
      if (overCardIndex !== -1) orderedIds.splice(overCardIndex, 0, cardId);
      else orderedIds.push(cardId);

      board.moveCard(cardId, targetColumnId, orderedIds);
    }
  }

  async function handleCreateCard() {
    if (!newCardColumnId || !newCardTitle.trim()) return;
    await board.createCard(newCardColumnId, newCardTitle.trim());
    setNewCardTitle('');
    setNewCardColumnId(null);
  }

  return (
    <div>
      <KanbanToolbar
        search={board.search}
        onSearchChange={board.setSearch}
        filters={board.filters}
        onFiltersChange={board.setFilters}
        filtersActive={board.filtersActive}
        availableLabels={allLabels}
        density={kanban.viewPrefs.density}
        onDensityChange={(density) => board.saveViewPrefs({ density })}
        onOpenColumnSettings={() => setColumnSettingsOpen(true)}
      />

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleColumns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'stretch', minHeight: 400 }}>
            {visibleColumns.map((col) => (
              <div key={col.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <KanbanColumn
                  column={col}
                  cards={board.cardsByColumn.get(col.id) ?? []}
                  density={kanban.viewPrefs.density}
                  width={kanban.viewPrefs.columnWidths[col.id] ?? DEFAULT_COLUMN_WIDTH}
                  collapsed={collapsedIds.has(col.id)}
                  onToggleCollapsed={() => toggleColumnCollapsed(col.id)}
                  onCardClick={(cardId) => setSelectedCardId(cardId)}
                  onRename={(name) => board.updateColumn(col.id, { name })}
                  onColumnMenu={() => setColumnSettingsOpen(true)}
                />
                {!collapsedIds.has(col.id) && (
                  newCardColumnId === col.id ? (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <input
                        autoFocus
                        value={newCardTitle}
                        onChange={(e) => setNewCardTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateCard()}
                        onBlur={() => !newCardTitle.trim() && setNewCardColumnId(null)}
                        placeholder="Título do card..."
                        style={{ flex: 1, padding: 6, fontSize: 12 }}
                      />
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
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {visibleColumns.length === 0 && !board.loading && (
        <p style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 24 }}>
          Nenhuma coluna visível. Abra "⚙ Colunas" pra criar ou mostrar alguma.
        </p>
      )}

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
    </div>
  );
}
