import { useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import Button from '@/components/layout/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useTabMeta } from '@/components/layout/tabs/useTabMeta';
import { useDecks } from './hooks/useDecks';
import { useFlashcards } from './hooks/useFlashcards';
import FlashcardListItem from './components/FlashcardListItem';
import FlashcardFormModal from './components/FlashcardFormModal';
import type { Flashcard } from './types/study.types';

export default function DeckPage() {
  const { deckId } = useParams({ from: '/study/$deckId' });
  const navigate = useNavigate();

  const { decks, loading: loadingDecks } = useDecks();
  const { cards, loading, error, create, update, remove, duplicate, reorder } = useFlashcards(deckId);

  const deck = decks.find((d) => d.id === deckId) ?? null;

  const [formOpen, setFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [deletingCard, setDeletingCard] = useState<Flashcard | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useTabMeta({
    title: loadingDecks ? 'Carregando...' : deck ? deck.name : 'Deck não encontrado',
    icon: deck?.icon ?? '📚',
    status: loadingDecks ? 'loading' : deck ? 'ready' : 'not-found',
    breadcrumb: deck ? ['Estudos', deck.name] : undefined,
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cards.findIndex((c) => c.id === active.id);
    const newIndex = cards.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(cards, oldIndex, newIndex);
    reorder(reordered.map((c) => c.id));
  };

  const openCreate = () => { setEditingCard(null); setFormOpen(true); };
  const openEdit = (card: Flashcard) => { setEditingCard(card); setFormOpen(true); };

  const handleSubmit = async (input: { front: string; back: string }) => {
    if (editingCard) {
      await update(editingCard.id, input);
    } else {
      await create(input);
    }
  };

  if (!loadingDecks && !deck) {
    return <p style={{ padding: 24 }}>Deck não encontrado.</p>;
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{deck?.icon ?? '📚'}</span> {deck?.name}
          </h1>
          {deck?.description && (
            <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>{deck.description}</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={openCreate}>+ Novo card</Button>
          <Button
            onClick={() => navigate({ to: '/study/$deckId/session', params: { deckId } })}
            disabled={cards.length === 0}
          >
            ▶ Iniciar estudo
          </Button>
        </div>
      </div>

      {error && <p style={{ color: '#d93025', fontSize: 13 }}>{error}</p>}

      {loading ? (
        <p style={{ color: '#999', fontSize: 13 }}>Carregando cards...</p>
      ) : cards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#999' }}>
          <p style={{ fontSize: 14, marginBottom: 12 }}>Este deck ainda não tem cards.</p>
          <Button onClick={openCreate}>+ Criar o primeiro card</Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {cards.map((card, i) => (
              <FlashcardListItem
                key={card.id}
                card={card}
                index={i}
                onEdit={() => openEdit(card)}
                onDuplicate={() => duplicate(card.id)}
                onDelete={() => setDeletingCard(card)}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      <FlashcardFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        card={editingCard}
      />

      <ConfirmDialog
        isOpen={!!deletingCard}
        title="Excluir card"
        message="Tem certeza que quer excluir este card? Essa ação não pode ser desfeita."
        onConfirm={async () => {
          if (deletingCard) await remove(deletingCard.id);
          setDeletingCard(null);
        }}
        onCancel={() => setDeletingCard(null)}
      />
    </div>
  );
}
