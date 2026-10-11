import { loadKanbanData, writeKanbanDataWithoutHistory } from '@/Kanban/api/kanbanDataStore';
import {
  applyEntry, emitHistoryChanged,
  type HistBucket, type HistEntry, type HistoryHost,
} from '@/Kanban/api/kanbanHistoryCore';

export { subscribeHistory } from '@/Kanban/api/kanbanHistoryCore';
export type { HistBucket, HistEntry } from '@/Kanban/api/kanbanHistoryCore';

/** Histórico do kanban: entradas da mais antiga pra mais nova; `pointer` = quantas estão aplicadas. */
export async function getHistory(kanbanId: string): Promise<HistBucket> {
  const data = await loadKanbanData();
  const bucket = data.history?.[kanbanId];
  return bucket ? { entries: bucket.entries, pointer: bucket.pointer } : { entries: [], pointer: 0 };
}

/** Leva o histórico do kanban até `targetPointer` (0 = tudo desfeito, entries.length = tudo aplicado). Devolve as entradas aplicadas/revertidas. */
export async function jumpTo(kanbanId: string, targetPointer: number): Promise<HistEntry[]> {
  const data = await loadKanbanData();
  const bucket = data.history?.[kanbanId];
  if (!bucket) return [];
  const target = Math.max(0, Math.min(bucket.entries.length, targetPointer));
  if (target === bucket.pointer) return [];
  const host = data as unknown as HistoryHost;
  const touched: HistEntry[] = [];
  if (target < bucket.pointer) {
    for (let i = bucket.pointer - 1; i >= target; i--) { applyEntry(host, bucket.entries[i], 'undo'); touched.push(bucket.entries[i]); }
  } else {
    for (let i = bucket.pointer; i < target; i++) { applyEntry(host, bucket.entries[i], 'redo'); touched.push(bucket.entries[i]); }
  }
  bucket.pointer = target;
  await writeKanbanDataWithoutHistory(data); // não registra a própria reversão como mudança nova
  emitHistoryChanged('applied');
  return touched;
}

/** Desfaz a última alteração do kanban. Devolve a entrada desfeita (ou null se não há nada). */
export async function undoOne(kanbanId: string): Promise<HistEntry | null> {
  const { pointer } = await getHistory(kanbanId);
  if (pointer <= 0) return null;
  return (await jumpTo(kanbanId, pointer - 1))[0] ?? null;
}

/** Refaz a última alteração desfeita. */
export async function redoOne(kanbanId: string): Promise<HistEntry | null> {
  const { pointer, entries } = await getHistory(kanbanId);
  if (pointer >= entries.length) return null;
  return (await jumpTo(kanbanId, pointer + 1))[0] ?? null;
}

export async function clearHistory(kanbanId: string): Promise<void> {
  const data = await loadKanbanData();
  if (!data.history?.[kanbanId]) return;
  delete data.history[kanbanId];
  await writeKanbanDataWithoutHistory(data);
  emitHistoryChanged('recorded');
}
