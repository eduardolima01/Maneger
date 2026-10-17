import type { KanbanCard } from '@/types/kanban.types';

/**
 * Marca de "card de plano": só o MODELO do plano (🔁 Plano · Ativo/Inativo). Ocorrências geradas e cards comuns: null.
 */
export default function PlanBadge({ card, size = 10 }: {
  card: Pick<KanbanCard, 'isPlanTemplate' | 'planActive'>;
  size?: number;
}) {
  const base = { fontSize: size, fontWeight: 600, padding: '1px 5px', borderRadius: 3, display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0, whiteSpace: 'nowrap' } as const;

  if (card.isPlanTemplate) {
    return (
      <span
        title={card.planActive ? 'Card de plano (modelo) — ativo: gera ocorrências' : 'Card de plano (modelo) — inativo: não gera ocorrências'}
        className={card.planActive
          ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
          : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'}
        style={base}
      >
        🔁 Plano · {card.planActive ? 'Ativo' : 'Inativo'}
      </span>
    );
  }

  return null;
}
