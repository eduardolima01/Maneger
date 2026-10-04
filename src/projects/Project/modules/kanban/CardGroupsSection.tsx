import { useState } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Button from '@/components/layout/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import KanbanCardModal from './KanbanCardModal';
import * as cardsApi from '@/lib/api/kanban/kanbanCards';
import { useCardGroups } from '@/lib/hooks/kanban/useCardGroups';
import type { KanbanCard } from '@/types/kanban.types';

interface CardGroupsSectionProps {
  parentCardId: string;
}

function SortableCardRow({ card, onOpen, onRequestDelete }: { card: KanbanCard; onOpen: () => void; onRequestDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700" style={{ ...style, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 4, marginBottom: 4 }}>
      <span {...attributes} {...listeners} className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 12, cursor: 'grab', touchAction: 'none' }} title="Arrastar">⠿</span>
      <span onClick={onOpen} style={{ flex: 1, fontSize: 13, cursor: 'pointer' }}>{card.title}</span>
      <button onClick={onRequestDelete} className="text-red-600 dark:text-red-400" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
    </div>
  );
}

/** Linha de card solto (sem grupo) — mesma aparência da SortableCardRow, mas sem drag (não tem lista pra reordenar). */
function LooseCardRow({ card, onOpen, onRequestDelete }: { card: KanbanCard; onOpen: () => void; onRequestDelete: () => void }) {
  return (
    <div className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 4, marginBottom: 4 }}>
      <span onClick={onOpen} style={{ flex: 1, fontSize: 13, cursor: 'pointer' }}>{card.title}</span>
      <button onClick={onRequestDelete} className="text-red-600 dark:text-red-400" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
    </div>
  );
}

export default function CardGroupsSection({ parentCardId }: CardGroupsSectionProps) {
  const {
    groups, cardsByGroup, ungroupedCards, loading,
    createGroup, renameGroup, removeGroup, reorderGroups,
    createCardInGroup, removeCard, reorderCardsInGroup, reload,
  } = useCardGroups(parentCardId);

  const [newGroupName, setNewGroupName] = useState('');
  const [newCardTitleByGroup, setNewCardTitleByGroup] = useState<Record<string, string>>({});
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteCardTarget, setDeleteCardTarget] = useState<{ id: string; title: string } | null>(null);
  const [openChildCard, setOpenChildCard] = useState<KanbanCard | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    await createGroup(newGroupName.trim());
    setNewGroupName('');
  }

  async function handleCreateCard(groupId: string) {
    const title = (newCardTitleByGroup[groupId] ?? '').trim();
    if (!title) return;
    await createCardInGroup(groupId, title);
    setNewCardTitleByGroup((prev) => ({ ...prev, [groupId]: '' }));
  }

  function handleGroupsDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = groups.map((g) => g.id);
    const from = ids.indexOf(active.id as string);
    const to = ids.indexOf(over.id as string);
    if (from === -1 || to === -1) return;
    reorderGroups(arrayMove(ids, from, to));
  }

  function handleCardsDragEnd(groupId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = (cardsByGroup[groupId] ?? []).map((c) => c.id);
    const from = ids.indexOf(active.id as string);
    const to = ids.indexOf(over.id as string);
    if (from === -1 || to === -1) return;
    reorderCardsInGroup(groupId, arrayMove(ids, from, to));
  }

  async function handleUpdateChildCard(id: string, input: Parameters<typeof cardsApi.updateCard>[1]) {
    await cardsApi.updateCard(id, input);
    const fresh = await cardsApi.getCardById(id);
    setOpenChildCard(fresh);
    reload(); // reflete título/etc. atualizado na linha da lista também
  }

  async function handleDuplicateChildCard(id: string) {
    await cardsApi.duplicateCard(id);
    setOpenChildCard(null);
    reload();
  }

  async function handleArchiveChildCard(id: string, archived: boolean) {
    await cardsApi.archiveCard(id, archived);
    setOpenChildCard(null);
    reload();
  }

  function requestDeleteChildCard(id: string, title: string) {
    setOpenChildCard(null);
    setDeleteCardTarget({ id, title });
  }

  if (loading) return <p className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 12 }}>Carregando grupos...</p>;

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupsDragEnd}>
        <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          {groups.map((group) => (
            <SortableGroupBlock
              key={group.id}
              groupId={group.id}
              name={group.name}
              cards={cardsByGroup[group.id] ?? []}
              onRename={(name) => renameGroup(group.id, name)}
              onRequestDelete={() => setDeleteGroupTarget({ id: group.id, name: group.name })}
              newCardTitle={newCardTitleByGroup[group.id] ?? ''}
              onNewCardTitleChange={(v) => setNewCardTitleByGroup((prev) => ({ ...prev, [group.id]: v }))}
              onCreateCard={() => handleCreateCard(group.id)}
              onCardsDragEnd={(e) => handleCardsDragEnd(group.id, e)}
              sensors={sensors}
              onOpenCard={setOpenChildCard}
              onRequestDeleteCard={requestDeleteChildCard}
            />
          ))}
        </SortableContext>
      </DndContext>

      {ungroupedCards.length > 0 && (
        <div className="border border-dashed border-neutral-300 dark:border-neutral-600" style={{ borderRadius: 6, padding: 8, marginBottom: 8 }}>
          <div className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Sem grupo
          </div>
          {ungroupedCards.map((c) => (
            <LooseCardRow
              key={c.id}
              card={c}
              onOpen={() => setOpenChildCard(c)}
              onRequestDelete={() => requestDeleteChildCard(c.id, c.title)}
            />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
          placeholder="Nome do novo grupo..."
          className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]"
          style={{ flex: 1, padding: 6, fontSize: 13 }}
        />
        <Button variant="secondary" onClick={handleCreateGroup}>+ Grupo</Button>
      </div>

      <ConfirmDialog
        isOpen={deleteGroupTarget !== null}
        title="Excluir grupo?"
        message={`Deseja realmente excluir "${deleteGroupTarget?.name}"? Todos os cards dentro dele também serão excluídos. Esta ação não pode ser desfeita.`}
        onConfirm={() => { if (deleteGroupTarget) removeGroup(deleteGroupTarget.id); setDeleteGroupTarget(null); }}
        onCancel={() => setDeleteGroupTarget(null)}
      />

      <ConfirmDialog
        isOpen={deleteCardTarget !== null}
        title="Excluir card?"
        message={`Deseja realmente excluir "${deleteCardTarget?.title}"? Esta ação não pode ser desfeita.`}
        onConfirm={() => { if (deleteCardTarget) removeCard(deleteCardTarget.id); setDeleteCardTarget(null); }}
        onCancel={() => setDeleteCardTarget(null)}
      />

      <KanbanCardModal
        isOpen={openChildCard !== null}
        onClose={() => setOpenChildCard(null)}
        card={openChildCard}
        onUpdate={handleUpdateChildCard}
        onDuplicate={handleDuplicateChildCard}
        onArchive={handleArchiveChildCard}
        onRequestDelete={requestDeleteChildCard}
      />
    </div>
  );
}

interface SortableGroupBlockProps {
  groupId: string;
  name: string;
  cards: KanbanCard[];
  onRename: (name: string) => void;
  onRequestDelete: () => void;
  onOpenCard: (card: KanbanCard) => void;
  onRequestDeleteCard: (id: string, title: string) => void;
  newCardTitle: string;
  onNewCardTitleChange: (v: string) => void;
  onCreateCard: () => void;
  onCardsDragEnd: (event: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}

function SortableGroupBlock({
  groupId, name, cards, onRename, onRequestDelete, onOpenCard, onRequestDeleteCard,
  newCardTitle, onNewCardTitleChange, onCreateCard, onCardsDragEnd, sensors,
}: SortableGroupBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: groupId });
  const [nameDraft, setNameDraft] = useState(name);
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} className="bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700" style={{ ...style, borderRadius: 6, padding: 8, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span {...attributes} {...listeners} className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 12, cursor: 'grab', touchAction: 'none' }} title="Arrastar">⠿</span>
        <input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => nameDraft.trim() && nameDraft !== name && onRename(nameDraft.trim())}
          className="text-neutral-900 dark:text-neutral-100"
          style={{ flex: 1, fontSize: 13, fontWeight: 600, border: 'none', background: 'none', outline: 'none' }}
        />
        <span className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11 }}>({cards.length})</span>
        <button onClick={onRequestDelete} className="text-red-600 dark:text-red-400" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCardsDragEnd}>
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <SortableCardRow key={c.id} card={c} onOpen={() => onOpenCard(c)} onRequestDelete={() => onRequestDeleteCard(c.id, c.title)} />
          ))}
        </SortableContext>
      </DndContext>

      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={newCardTitle}
          onChange={(e) => onNewCardTitleChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCreateCard()}
          placeholder="Novo card..."
          className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]"
          style={{ flex: 1, padding: 6, fontSize: 12 }}
        />
        <button
          onClick={onCreateCard}
          disabled={!newCardTitle.trim()}
          className={newCardTitle.trim() ? 'bg-blue-600 text-white' : 'bg-neutral-300 dark:bg-neutral-600 text-white'}
          style={{ padding: '6px 10px', fontSize: 12, border: 'none', borderRadius: 4, cursor: newCardTitle.trim() ? 'pointer' : 'default' }}
        >
          +
        </button>
      </div>
    </div>
  );
}
