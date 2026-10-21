import { useCallback, useEffect, useState } from 'react';
import { loadKanbanData } from '@/Kanban/api/kanbanDataStore';
import { listenKanbanChanges } from '@/Kanban/utils/kanbanSync';
import type { KanbanChecklistItem } from '@/types/kanban.types';

export interface TaskRow { id: string; title: string; depth: number }

/** Tarefas do plano = itens da checklist que entram na conta (fora de "lista simples"), na ordem da árvore. */
export function buildTasks(items: KanbanChecklistItem[]): TaskRow[] {
  const byParent = new Map<string | null, KanbanChecklistItem[]>();
  for (const it of items) {
    const arr = byParent.get(it.parentItemId ?? null) ?? [];
    arr.push(it);
    byParent.set(it.parentItemId ?? null, arr);
  }
  const out: TaskRow[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const it of (byParent.get(parent) ?? []).sort((a, b) => a.position - b.position)) {
      if (it.simple) continue; // "lista simples": o item e tudo abaixo ficam de fora
      out.push({ id: it.id, title: it.title, depth });
      walk(it.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Itens de checklist de VÁRIOS cards numa leitura só (recarrega quando o kanban muda). */
export function usePlanItems(cardIds: string[]): Map<string, KanbanChecklistItem[]> {
  const key = cardIds.join(',');
  const [map, setMap] = useState<Map<string, KanbanChecklistItem[]>>(new Map());
  const reload = useCallback(async () => {
    try {
      const wanted = new Set(key ? key.split(',') : []);
      const data = await loadKanbanData();
      const m = new Map<string, KanbanChecklistItem[]>();
      for (const it of data.checklistItems) {
        if (!wanted.has(it.cardId)) continue;
        const arr = m.get(it.cardId);
        if (arr) arr.push(it); else m.set(it.cardId, [it]);
      }
      setMap(m);
    } catch { /* mantém o que já tinha */ }
  }, [key]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => listenKanbanChanges(() => void reload()), [reload]);
  return map;
}
