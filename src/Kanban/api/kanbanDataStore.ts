import { invoke } from '@tauri-apps/api/core';
import type { Kanban, KanbanColumn, KanbanCardGroup, KanbanCard, KanbanChecklistItem, ParentCardGroup } from '@/types/kanban.types';
import { recordHistory, emitHistoryChanged, type HistBucket, type HistoryHost } from '@/Kanban/api/kanbanHistoryCore';
import { broadcastKanbanChange } from '@/Kanban/utils/kanbanSync';

export interface KanbanDataFile {
  kanbans: Kanban[];
  columns: KanbanColumn[];
  cardGroups: KanbanCardGroup[];
  cards: KanbanCard[];
  checklistItems: KanbanChecklistItem[];
  /** Grupos do fluxo separado "card-pai" (CardGroupsSection/useCardGroups) — nunca se mistura com cardGroups. */
  parentCardGroups: ParentCardGroup[];
  migratedFromSqliteAt?: string;
  /** Histórico de alterações (desfazer/refazer), uma pilha por kanban (id do kanban). Ver kanbanHistoryCore.ts. */
  history?: Record<string, HistBucket>;
}

function emptyData(): KanbanDataFile {
  return { kanbans: [], columns: [], cardGroups: [], cards: [], checklistItems: [], parentCardGroups: [] };
}

/**
 * Texto do JSON exatamente como foi lido (ou gravado pela última vez) pra CADA objeto devolvido por loadKanbanData.
 * O código chama `load → muda o objeto → save`, então é aqui que dá pra comparar "antes" com "depois" sem tocar em cada ação.
 */
const baselines = new WeakMap<object, string>();

export async function loadKanbanData(): Promise<KanbanDataFile> {
  const raw = await invoke<string>('load_kanban_data');
  let data: KanbanDataFile;
  try {
    data = { ...emptyData(), ...JSON.parse(raw) };
  } catch {
    data = emptyData();
  }
  baselines.set(data, raw);
  return data;
}

export async function saveKanbanData(data: KanbanDataFile): Promise<void> {
  const before = baselines.get(data);
  if (before !== undefined) {
    try {
      recordHistory(before, data as unknown as HistoryHost);
    } catch (err) {
      console.warn('Histórico do kanban: não consegui registrar esta alteração', err); // o histórico nunca impede de gravar
    }
  }
  const out = JSON.stringify(data, null, 2);
  await invoke('save_kanban_data', { data: out });
  baselines.set(data, out);
  emitHistoryChanged('recorded');
  broadcastKanbanChange(); // avisa as outras janelas (quadro ↔ modo trabalho)
}

/** Grava sem registrar no histórico — usado só por desfazer/refazer (a reversão não vira "alteração nova"). */
export async function writeKanbanDataWithoutHistory(data: KanbanDataFile): Promise<void> {
  const out = JSON.stringify(data, null, 2);
  await invoke('save_kanban_data', { data: out });
  baselines.set(data, out);
  broadcastKanbanChange();
}
