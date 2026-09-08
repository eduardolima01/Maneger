import { invoke } from '@tauri-apps/api/core';
import type { Deck, Flashcard } from '../types/study.types';

export interface StudyData {
  decks: Deck[];
  cards: Flashcard[];
}

function emptyData(): StudyData {
  return { decks: [], cards: [] };
}

/**
 * Carrega o blob único de Estudos (todos os decks + todos os cards).
 * Igual ao padrão load_page_visibility_prefs/load_tabs_state: um arquivo JSON
 * global (não por projeto), parseado aqui no front. Falha (JSON ausente/corrompido)
 * cai silenciosamente pra estrutura vazia, mesmo critério usado no filtro de
 * projeto do comparativo de semanas (Agenda).
 */
export async function loadStudyData(): Promise<StudyData> {
  const raw = await invoke<string>('load_study_data');
  try {
    const parsed = JSON.parse(raw);
    return {
      decks: Array.isArray(parsed.decks) ? parsed.decks : [],
      cards: Array.isArray(parsed.cards) ? parsed.cards : [],
    };
  } catch {
    return emptyData();
  }
}

export async function saveStudyData(data: StudyData): Promise<void> {
  await invoke('save_study_data', { data: JSON.stringify(data) });
}
