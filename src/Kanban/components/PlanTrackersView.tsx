import { useMemo, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import PlanPanel from '@/Kanban/components/PlanPeek';
import PlanDistributionBar from '@/Kanban/components/PlanDistributionBar';
import type { KanbanCard, KanbanColumn, KanbanCardGroup } from '@/types/kanban.types';

/**
 * Visão "Planos": só o "Acompanhamento do plano" dos cards de plano deste kanban, um abaixo do outro
 * (gráfico de contribuições, tarefas do dia e relatório de cada um), sem colunas nem grupos.
 * Cada plano mostra a capa do card e a coluna onde ele está (com a capa da coluna); pode ser recolhido; "↗" abre o card normal.
 */
export default function PlanTrackersView({ cards, columns, groups, onOpenCard }: {
  cards: KanbanCard[];
  columns: KanbanColumn[];
  groups: KanbanCardGroup[];
  onOpenCard: (cardId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const columnById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  /** Coluna do card: direto, ou pela coluna do grupo/subgrupo em que ele está. */
  const columnOf = (c: KanbanCard): KanbanColumn | null => {
    const colId = c.columnId ?? (c.cardGroupId ? groupById.get(c.cardGroupId)?.columnId : null) ?? null;
    return colId ? columnById.get(colId) ?? null : null;
  };

  const plans = useMemo(
    () => cards.filter((c) => c.isPlanTemplate && c.planTrackOnly && !c.archived),
    [cards],
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plans.filter((p) => (!onlyActive || p.planActive) && (!q || p.title.toLowerCase().includes(q)));
  }, [plans, query, onlyActive]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const faint = 'text-neutral-500 dark:text-neutral-400';

  if (plans.length === 0) {
    return (
      <div className={`${faint} border border-dashed border-neutral-300 dark:border-neutral-700`} style={{ padding: 24, borderRadius: 8, fontSize: 13, textAlign: 'center' }}>
        Nenhum card de plano em modo acompanhamento neste kanban.<br />
        Abra um card de plano e marque <b>“Acompanhar neste card (não criar card novo)”</b>.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar planos…"
          aria-label="Filtrar planos"
          className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600"
          style={{ flex: 1, minWidth: 160, fontSize: 12, padding: '4px 8px', borderRadius: 6 }}
        />
        <label className={faint} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          Só ativos
        </label>
        <button
          type="button"
          onClick={() => setCollapsed(collapsed.size >= shown.length && shown.length > 0 ? new Set() : new Set(shown.map((p) => p.id)))}
          className={`${faint} bg-transparent border-0 cursor-pointer underline`}
          style={{ fontSize: 12 }}
        >
          {collapsed.size >= shown.length && shown.length > 0 ? 'Expandir todos' : 'Recolher todos'}
        </button>
        <span className={faint} style={{ fontSize: 11 }}>{shown.length} de {plans.length} planos</span>
      </div>

      {shown.length === 0 && <div className={faint} style={{ fontSize: 12 }}>Nenhum plano combina com o filtro.</div>}

      {shown.map((p) => {
        const open = !collapsed.has(p.id);
        const col = columnOf(p);
        return (
          <section key={p.id} style={{ opacity: p.planActive ? 1 : 0.7 }}>
            <div
              className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: open ? '6px 6px 0 0' : 6 }}
            >
              <button
                type="button"
                onClick={() => toggle(p.id)}
                aria-expanded={open}
                title={open ? 'Recolher' : 'Expandir'}
                className="text-neutral-700 dark:text-neutral-200 bg-transparent border-0 cursor-pointer"
                style={{ fontSize: 12, padding: 0 }}
              >
                {open ? '▾' : '▸'}
              </button>
              {p.coverPath && (
                <img
                  src={convertFileSrc(p.coverPath)}
                  alt=""
                  title="Capa do card"
                  style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              <span className="text-neutral-900 dark:text-neutral-100" style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.title}>
                {p.title}{!p.planActive && <span className={faint} style={{ fontWeight: 400, fontSize: 11 }}> · inativo</span>}
              </span>
              {!open && <PlanBarOnly card={p} />}
              {col && <ColumnChip column={col} />}
              <button
                type="button"
                onClick={() => onOpenCard(p.id)}
                title="Abrir o card"
                aria-label="Abrir o card"
                className={`${faint} bg-transparent border-0 cursor-pointer`}
                style={{ fontSize: 13 }}
              >
                ↗
              </button>
            </div>
            {open && <PlanPanel card={p} hideHeader style={{ marginBottom: 0, borderRadius: '0 0 6px 6px', borderTop: 'none' }} />}
          </section>
        );
      })}
    </div>
  );
}

/** Com o plano recolhido, a barra de distribuição continua visível no cabeçalho (sem o botão 📊, que aqui não faz sentido). */
function PlanBarOnly({ card }: { card: KanbanCard }) {
  return <PlanDistributionBar card={card} inline open={false} onToggle={() => { }} hideToggle />;
}

/** A coluna do plano: capa (se tiver), ícone e nome, com a cor da coluna na borda. */
function ColumnChip({ column }: { column: KanbanColumn }) {
  return (
    <span
      title={`Coluna: ${column.name}`}
      className="bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 180, flexShrink: 0, fontSize: 11, padding: column.coverPath ? '0 8px 0 0' : '2px 8px', borderRadius: 6, overflow: 'hidden', borderLeft: `3px solid ${column.color ?? 'transparent'}` }}
    >
      {column.coverPath && (
        <img src={convertFileSrc(column.coverPath)} alt="" title="Capa da coluna" style={{ width: 32, height: 28, objectFit: 'cover', flexShrink: 0 }} />
      )}
      {column.icon && <span>{column.icon}</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{column.name}</span>
    </span>
  );
}
