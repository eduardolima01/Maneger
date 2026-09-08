import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import Button from '@/components/layout/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useTabMeta } from '@/components/layout/tabs/useTabMeta';
import { useDecks } from './hooks/useDecks';
import DeckCard from './components/DeckCard';
import DeckFormModal from './components/DeckFormModal';
import type { Deck } from './types/study.types';

export default function DecksPage() {
  const navigate = useNavigate();
  const { decks, cardCounts, loading, error, create, update, remove, duplicate } = useDecks();

  const [formOpen, setFormOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [deletingDeck, setDeletingDeck] = useState<Deck | null>(null);

  useTabMeta({
    title: 'Estudos',
    icon: '📚',
    status: loading ? 'loading' : 'ready',
  });

  const openCreate = () => { setEditingDeck(null); setFormOpen(true); };
  const openEdit = (deck: Deck) => { setEditingDeck(deck); setFormOpen(true); };

  const handleSubmit = async (input: Parameters<typeof create>[0]) => {
    if (editingDeck) {
      await update(editingDeck.id, input);
    } else {
      await create(input);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>📚 Estudos</h1>
        <Button onClick={openCreate}>+ Novo deck</Button>
      </div>

      {error && <p style={{ color: '#d93025', fontSize: 13 }}>{error}</p>}

      {loading ? (
        <p style={{ color: '#999', fontSize: 13 }}>Carregando decks...</p>
      ) : decks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#999' }}>
          <p style={{ fontSize: 14, marginBottom: 12 }}>Você ainda não tem nenhum deck de flashcards.</p>
          <Button onClick={openCreate}>+ Criar meu primeiro deck</Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              cardCount={cardCounts[deck.id] ?? 0}
              onOpen={() => navigate({ to: '/study/$deckId', params: { deckId: deck.id } })}
              onEdit={() => openEdit(deck)}
              onDuplicate={() => duplicate(deck.id)}
              onDelete={() => setDeletingDeck(deck)}
            />
          ))}
        </div>
      )}

      <DeckFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} deck={editingDeck} />

      <ConfirmDialog
        isOpen={!!deletingDeck}
        title="Excluir deck"
        message={`Tem certeza que quer excluir "${deletingDeck?.name}"? Todos os cards desse deck também serão excluídos. Essa ação não pode ser desfeita.`}
        onConfirm={async () => {
          if (deletingDeck) await remove(deletingDeck.id);
          setDeletingDeck(null);
        }}
        onCancel={() => setDeletingDeck(null)}
      />
    </div>
  );
}
