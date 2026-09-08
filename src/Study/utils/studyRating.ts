import type { StudyRating, FlashcardSrsState } from '../types/study.types';

export const RATING_LABELS: Record<StudyRating, string> = {
  again: 'Errei',
  hard: 'Difícil',
  easy: 'Fácil',
};

export const RATING_COLORS: Record<StudyRating, string> = {
  again: '#d93025',
  hard: '#f4511e',
  easy: '#1e8e3e',
};

/**
 * Aplica o resultado de uma revisão ao estado de SRS do card.
 *
 * Hoje é intencionalmente um no-op estrutural: apenas conta a revisão, sem calcular
 * intervalo/próxima data (repetição espaçada explicitamente fora de escopo desta parte).
 * Este é o ponto de extensão pra FSRS/SM-2 no futuro — quem chama (useStudySession)
 * não muda quando isso for implementado de verdade.
 */
export function applyRating(current: FlashcardSrsState | undefined, _rating: StudyRating): FlashcardSrsState {
  return {
    ...current,
    reviewCount: (current?.reviewCount ?? 0) + 1,
  };
}
