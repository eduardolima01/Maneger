import { useState, useEffect, useCallback } from 'react';
import * as decksApi from '../api/decks';
import * as flashcardsApi from '../api/flashcards';
import { applyRating } from '../utils/studyRating';
import type { Deck, Flashcard, StudyRating } from '../types/study.types';

interface RatingCounts {
  again: number;
  hard: number;
  easy: number;
}

/**
 * Sessão de estudo é inteiramente em memória: não persiste progresso/estatísticas
 * entre sessões (fora de escopo desta parte). Ordem de apresentação = ordem de
 * `position` do deck (mesma ordem da tela de visualização do deck).
 */
export function useStudySession(deckId: string) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [counts, setCounts] = useState<RatingCounts>({ again: 0, hard: 0, easy: 0 });
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([decksApi.getDeckById(deckId), flashcardsApi.getCardsByDeck(deckId)])
      .then(([foundDeck, cardList]) => {
        if (cancelled) return;
        setDeck(foundDeck);
        setCards(cardList);
        setIndex(0);
        setRevealed(false);
        setCounts({ again: 0, hard: 0, easy: 0 });
        setFinished(cardList.length === 0);
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar este deck para estudo.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [deckId]);

  const currentCard = cards[index] ?? null;
  const total = cards.length;

  const reveal = useCallback(() => setRevealed(true), []);

  const rate = useCallback((rating: StudyRating) => {
    setCounts((prev) => ({ ...prev, [rating]: prev[rating] + 1 }));

    // Ponto de extensão: quando SRS existir, o resultado de applyRating(...) deve ser
    // persistido no card aqui (updateCard com o novo `srs`). Hoje é só contabilizado.
    if (currentCard) applyRating(currentCard.srs, rating);

    setRevealed(false);
    setIndex((prev) => {
      const next = prev + 1;
      if (next >= cards.length) {
        setFinished(true);
        return prev;
      }
      return next;
    });
  }, [cards.length, currentCard]);

  const restart = useCallback(() => {
    setIndex(0);
    setRevealed(false);
    setCounts({ again: 0, hard: 0, easy: 0 });
    setFinished(cards.length === 0);
  }, [cards.length]);

  return { deck, cards, loading, error, currentCard, index, total, revealed, reveal, rate, finished, counts, restart };
}
