import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import { loadStudyData, saveStudyData } from './studyStorage';
import type { Deck, CreateDeckInput, UpdateDeckInput } from '../types/study.types';

export async function getDecks(): Promise<Deck[]> {
  const data = await loadStudyData();
  return data.decks;
}

export async function getDeckById(id: string): Promise<Deck | null> {
  const data = await loadStudyData();
  return data.decks.find((d) => d.id === id) ?? null;
}

export async function createDeck(input: CreateDeckInput): Promise<string> {
  const data = await loadStudyData();
  const now = toLocalISO(new Date());
  const id = generateId();

  data.decks.push({
    id,
    name: input.name,
    description: input.description ?? null,
    color: input.color ?? null,
    icon: input.icon ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await saveStudyData(data);
  return id;
}

export async function updateDeck(id: string, input: UpdateDeckInput): Promise<void> {
  const data = await loadStudyData();
  const deck = data.decks.find((d) => d.id === id);
  if (!deck) return;

  if (input.name !== undefined) deck.name = input.name;
  if (input.description !== undefined) deck.description = input.description;
  if (input.color !== undefined) deck.color = input.color;
  if (input.icon !== undefined) deck.icon = input.icon;
  deck.updatedAt = toLocalISO(new Date());

  await saveStudyData(data);
}

export async function deleteDeck(id: string): Promise<void> {
  const data = await loadStudyData();
  data.decks = data.decks.filter((d) => d.id !== id);
  data.cards = data.cards.filter((c) => c.deckId !== id); // cards órfãos não fazem sentido — deck é o "dono"
  await saveStudyData(data);
}

/** Duplica o deck e todos os seus cards (posições preservadas, sem estado de SRS herdado). */
export async function duplicateDeck(id: string): Promise<string> {
  const data = await loadStudyData();
  const original = data.decks.find((d) => d.id === id);
  if (!original) throw new Error('Deck não encontrado para duplicar');

  const now = toLocalISO(new Date());
  const newId = generateId();

  data.decks.push({
    ...original,
    id: newId,
    name: `${original.name} (cópia)`,
    createdAt: now,
    updatedAt: now,
  });

  const originalCards = data.cards
    .filter((c) => c.deckId === id)
    .sort((a, b) => a.position - b.position);

  for (const card of originalCards) {
    data.cards.push({
      id: generateId(),
      deckId: newId,
      front: card.front,
      back: card.back,
      position: card.position,
      createdAt: now,
      updatedAt: now,
      // srs intencionalmente não copiado: a cópia começa "zerada" quando SRS existir
    });
  }

  await saveStudyData(data);
  return newId;
}

export async function getCardCountsByDeck(): Promise<Record<string, number>> {
  const data = await loadStudyData();
  const counts: Record<string, number> = {};
  for (const deck of data.decks) counts[deck.id] = 0;
  for (const card of data.cards) counts[card.deckId] = (counts[card.deckId] ?? 0) + 1;
  return counts;
}
