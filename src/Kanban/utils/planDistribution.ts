import type { KanbanCard, KanbanChecklistItem } from '@/types/kanban.types';

/**
 * Distribuição dos dias de um plano acompanhado no próprio card (mesma regra do gráfico de contribuições):
 * dia previsto = dia da semana do plano entre início e fim; verde = todas as tarefas feitas, amarelo = algumas,
 * vermelho = já passou sem nenhuma, pendente = ainda sem nenhuma (hoje/futuro) ou plano sem tarefas.
 */
export interface PlanDistribution { total: number; done: number; partial: number; missed: number; pending: number }

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseKey(k: string): Date {
  const [y, m, d] = k.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Ids das tarefas do plano: itens da checklist fora de "lista simples" (o item marcado e tudo abaixo dele ficam de fora). */
export function planTaskIds(items: KanbanChecklistItem[]): Set<string> {
  const byParent = new Map<string | null, KanbanChecklistItem[]>();
  for (const it of items) {
    const arr = byParent.get(it.parentItemId ?? null) ?? [];
    arr.push(it);
    byParent.set(it.parentItemId ?? null, arr);
  }
  const ids = new Set<string>();
  const walk = (parent: string | null) => {
    for (const it of byParent.get(parent) ?? []) {
      if (it.simple) continue;
      ids.add(it.id);
      walk(it.id);
    }
  };
  walk(null);
  return ids;
}

export function computePlanDistribution(card: KanbanCard, items: KanbanChecklistItem[]): PlanDistribution | null {
  const start = card.startDate?.slice(0, 10);
  const end = card.dueDate?.slice(0, 10);
  if (!start || !end || start > end) return null;
  const ids = planTaskIds(items);
  const weekdays = card.planWeekdays.length > 0 ? card.planWeekdays : [0, 1, 2, 3, 4, 5, 6];
  const checks = card.planDayChecks ?? {};
  const today = keyOf(new Date());
  const r: PlanDistribution = { total: 0, done: 0, partial: 0, missed: 0, pending: 0 };
  const last = parseKey(end);
  for (let d = parseKey(start); d <= last; d.setDate(d.getDate() + 1)) {
    if (!weekdays.includes(d.getDay())) continue;
    const k = keyOf(d);
    r.total++;
    const done = (checks[k] ?? []).filter((id) => ids.has(id)).length;
    if (ids.size > 0 && done >= ids.size) r.done++;
    else if (done > 0) r.partial++;
    else if (ids.size > 0 && k < today) r.missed++;
    else r.pending++;
  }
  return r;
}
