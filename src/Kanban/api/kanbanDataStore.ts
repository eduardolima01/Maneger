import { invoke } from '@tauri-apps/api/core';
import type { Kanban, KanbanColumn, KanbanCardGroup, KanbanCard, KanbanChecklistItem, ParentCardGroup } from '@/types/kanban.types';

export interface KanbanDataFile {
  kanbans: Kanban[];
  columns: KanbanColumn[];
  cardGroups: KanbanCardGroup[];
  cards: KanbanCard[];
  checklistItems: KanbanChecklistItem[];
  /** Grupos do fluxo separado "card-pai" (CardGroupsSection/useCardGroups) — nunca se mistura com cardGroups. */
  parentCardGroups: ParentCardGroup[];
  migratedFromSqliteAt?: string;
}

function emptyData(): KanbanDataFile {
  return { kanbans: [], columns: [], cardGroups: [], cards: [], checklistItems: [], parentCardGroups: [] };
}

export async function loadKanbanData(): Promise<KanbanDataFile> {
  const raw = await invoke<string>('load_kanban_data');
  try {
    const parsed = JSON.parse(raw);
    return { ...emptyData(), ...parsed };
  } catch {
    return emptyData();
  }
}

export async function saveKanbanData(data: KanbanDataFile): Promise<void> {
  await invoke('save_kanban_data', { data: JSON.stringify(data, null, 2) });
}
