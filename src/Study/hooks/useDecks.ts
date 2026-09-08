import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/decks';
import type { Deck, CreateDeckInput, UpdateDeckInput } from '../types/study.types';

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cardCounts, setCardCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deckList, counts] = await Promise.all([api.getDecks(), api.getCardCountsByDeck()]);
      setDecks(deckList);
      setCardCounts(counts);
    } catch {
      setError('Não foi possível carregar os decks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (input: CreateDeckInput) => {
    const id = await api.createDeck(input);
    await reload();
    return id;
  }, [reload]);

  const update = useCallback(async (id: string, input: UpdateDeckInput) => {
    await api.updateDeck(id, input);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await api.deleteDeck(id);
    await reload();
  }, [reload]);

  const duplicate = useCallback(async (id: string) => {
    await api.duplicateDeck(id);
    await reload();
  }, [reload]);

  return { decks, cardCounts, loading, error, reload, create, update, remove, duplicate };
}
