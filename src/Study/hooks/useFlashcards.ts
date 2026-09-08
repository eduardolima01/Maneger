import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/flashcards';
import type { Flashcard, CreateFlashcardInput, UpdateFlashcardInput } from '../types/study.types';

export function useFlashcards(deckId: string) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getCardsByDeck(deckId);
      setCards(list);
    } catch {
      setError('Não foi possível carregar os cards deste deck.');
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (input: Omit<CreateFlashcardInput, 'deckId'>) => {
    const id = await api.createCard({ ...input, deckId });
    await reload();
    return id;
  }, [deckId, reload]);

  const update = useCallback(async (id: string, input: UpdateFlashcardInput) => {
    await api.updateCard(id, input);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await api.deleteCard(id);
    await reload();
  }, [reload]);

  const duplicate = useCallback(async (id: string) => {
    await api.duplicateCard(id);
    await reload();
  }, [reload]);

  const reorderLocally = useCallback((orderedIds: string[]) => {
    setCards((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      return orderedIds.map((id) => map.get(id)).filter((c): c is Flashcard => !!c);
    });
  }, []);

  const reorder = useCallback(async (orderedIds: string[]) => {
    reorderLocally(orderedIds);
    try {
      await api.reorderCards(deckId, orderedIds);
    } catch {
      await reload();
    }
  }, [deckId, reorderLocally, reload]);

  return { cards, loading, error, reload, create, update, remove, duplicate, reorder };
}
