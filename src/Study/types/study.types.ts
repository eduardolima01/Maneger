export interface Deck {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeckInput {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
}

export type UpdateDeckInput = Partial<{
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
}>;

/**
 * Estado de repetição espaçada — NÃO implementado ainda (ver pendências do módulo).
 * Mantido opcional para que os dados existentes continuem válidos quando a feature
 * for adicionada (não exige migração do JSON persistido).
 */
export interface FlashcardSrsState {
  dueAt?: string;
  intervalDays?: number;
  easeFactor?: number;
  reviewCount?: number;
}

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  srs?: FlashcardSrsState;
}

export interface CreateFlashcardInput {
  deckId: string;
  front: string;
  back: string;
}

export type UpdateFlashcardInput = Partial<{
  front: string;
  back: string;
}>;

/** Resultado de uma revisão no modo de estudo: Errei / Difícil / Fácil. */
export type StudyRating = 'again' | 'hard' | 'easy';

export const DECK_ICON_PRESETS = ['📚', '🧠', '✏️', '🔬', '🌍', '💡', '🗂️', '🎯'];

export const DECK_COLOR_PRESETS = [
  '#1a73e8', '#1e8e3e', '#f4511e', '#9c27b0', '#00897b', '#c62828', '#f9a825', '#5c6bc0',
];
