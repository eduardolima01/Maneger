import { useCallback, useEffect, useState } from 'react';
import { loadKanbanData } from '@/Kanban/api/kanbanDataStore';
import { listenKanbanChanges } from '@/Kanban/utils/kanbanSync';
import { computePlanDistribution } from '@/Kanban/utils/planDistribution';
import type { KanbanCard, KanbanChecklistItem } from '@/types/kanban.types';

/** Linha "Distribuição dos dias" do card de plano (verde/amarelo/vermelho/pendente), sem abrir o card. */
const GREEN = '#2ea043';
const YELLOW = '#f4a623';
const RED = '#d73a49';

interface Props {
  card: KanbanCard;
  /** Só a barra, bem fina e curta (linha da visão em árvore) — sem os números. */
  inline?: boolean;
}

export default function PlanDistributionBar({ card, inline }: Props) {
  const [items, setItems] = useState<KanbanChecklistItem[]>([]);
  const reload = useCallback(async () => {
    try {
      const data = await loadKanbanData();
      setItems(data.checklistItems.filter((i) => i.cardId === card.id));
    } catch { /* mantém o que já tinha */ }
  }, [card.id]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => listenKanbanChanges(() => void reload()), [reload]);

  const dist = computePlanDistribution(card, items);
  if (!dist || dist.total === 0) return null;

  const title = `Distribuição dos dias: ${dist.done} completos · ${dist.partial} parciais · ${dist.missed} perdidos · ${dist.pending} pendentes`;
  const seg = (n: number, color: string, label: string) => (n > 0
    ? <div title={`${label}: ${n}`} style={{ width: `${(n / dist.total) * 100}%`, backgroundColor: color }} />
    : null);

  const bar = (
    <div
      role="img" aria-label={title} title={title}
      className="bg-neutral-200 dark:bg-neutral-700"
      style={{ display: 'flex', height: inline ? 5 : 6, width: inline ? 56 : '100%', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}
    >
      {seg(dist.done, GREEN, 'Completos')}
      {seg(dist.partial, YELLOW, 'Parciais')}
      {seg(dist.missed, RED, 'Perdidos')}
    </div>
  );
  if (inline) return bar;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
      {bar}
      <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 10 }}>
        🟩 {dist.done} · 🟨 {dist.partial} · 🟥 {dist.missed} · ⬜ {dist.pending}
      </span>
    </div>
  );
}
