import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import { loadStudyData, saveStudyData } from './studyStorage';
import type { Flashcard, CreateFlashcardInput, UpdateFlashcardInput } from '../types/study.types';

export async function getCardsByDeck(deckId: string): Promise<Flashcard[]> {
  const data = await loadStudyData();
  return data.cards
    .filter((c) => c.deckId === deckId)
    .sort((a, b) => a.position - b.position);
}

export async function getCardById(id: string): Promise<Flashcard | null> {
  const data = await loadStudyData();
  return data.cards.find((c) => c.id === id) ?? null;
}

function nextPositionFor(cards: Flashcard[], deckId: string): number {
  const deckCards = cards.filter((c) => c.deckId === deckId);
  return deckCards.length > 0 ? Math.max(...deckCards.map((c) => c.position)) + 1 : 0;
}

export async function createCard(input: CreateFlashcardInput): Promise<string> {
  const data = await loadStudyData();
  const now = toLocalISO(new Date());
  const id = generateId();

  data.cards.push({
    id,
    deckId: input.deckId,
    front: input.front,
    back: input.back,
    position: nextPositionFor(data.cards, input.deckId),
    createdAt: now,
    updatedAt: now,
  });

  await saveStudyData(data);
  return id;
}

export async function updateCard(id: string, input: UpdateFlashcardInput): Promise<void> {
  const data = await loadStudyData();
  const card = data.cards.find((c) => c.id === id);
  if (!card) return;

  if (input.front !== undefined) card.front = input.front;
  if (input.back !== undefined) card.back = input.back;
  card.updatedAt = toLocalISO(new Date());

  await saveStudyData(data);
}

export async function deleteCard(id: string): Promise<void> {
  const data = await loadStudyData();
  data.cards = data.cards.filter((c) => c.id !== id);
  await saveStudyData(data);
}

export async function duplicateCard(id: string): Promise<string> {
  const data = await loadStudyData();
  const original = data.cards.find((c) => c.id === id);
  if (!original) throw new Error('Card não encontrado para duplicar');

  const now = toLocalISO(new Date());
  const newId = generateId();

  data.cards.push({
    id: newId,
    deckId: original.deckId,
    front: original.front,
    back: original.back,
    position: nextPositionFor(data.cards, original.deckId),
    createdAt: now,
    updatedAt: now,
  });

  await saveStudyData(data);
  return newId;
}

/** Reescreve `position` de todos os cards do deck conforme a ordem recebida (drag and drop). */
export async function reorderCards(deckId: string, orderedIds: string[]): Promise<void> {
  const data = await loadStudyData();
  const posMap = new Map(orderedIds.map((id, i) => [id, i]));
  for (const card of data.cards) {
    if (card.deckId === deckId && posMap.has(card.id)) {
      card.position = posMap.get(card.id)!;
    }
  }
  await saveStudyData(data);
}
