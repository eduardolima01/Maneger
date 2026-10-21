import { useMemo, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import PlanTracker from '@/Kanban/components/PlanTracker';
import PlanDayPanel from '@/Kanban/components/PlanDayPanel';
import PlanDistributionBar from '@/Kanban/components/PlanDistributionBar';
import { usePlanPersist } from '@/Kanban/utils/planPersist';
import { buildTasks, usePlanItems } from '@/Kanban/utils/planTasks';
import type { TaskRow } from '@/Kanban/utils/planTasks';
import { todayInfo, fmtShortDate, TODAY_COLORS, TODAY_LABEL } from '@/Kanban/utils/planToday';
import type { TodayInfo } from '@/Kanban/utils/planToday';
import type { KanbanCard, KanbanColumn, KanbanCardGroup } from '@/types/kanban.types';

/**
 * Visão "Planos": só o "Acompanhamento do plano" dos cards de plano deste kanban, um abaixo do outro
 * (gráfico de contribuições, tarefas do dia e relatório de cada um), sem colunas nem grupos.
 *  - faixa "Hoje" no topo: um quadrado por plano com dia previsto hoje (clique = abre as tarefas de hoje daquele plano);
 *  - cada plano mostra o quadrado de HOJE no cabeçalho (cor, contador e o título do dia), a capa do card e a coluna dele
 *    (com a capa da coluna); pode ser recolhido; "↗" abre o card normal.
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
  const [todayOpen, setTodayOpen] = useState<Set<string>>(new Set()); // planos com as tarefas de hoje abertas no cabeçalho
  const sectionRefs = useRef(new Map<string, HTMLElement>());

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

  // checklist de todos os planos numa leitura só (a faixa "Hoje" e os cabeçalhos usam o mesmo dado)
  const itemsByPlan = usePlanItems(plans.map((p) => p.id));
  const tasksOf = (id: string): TaskRow[] => buildTasks(itemsByPlan.get(id) ?? []);

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleToday(id: string, force?: boolean) {
    setTodayOpen((prev) => {
      const next = new Set(prev);
      const want = force ?? !next.has(id);
      if (want) next.add(id); else next.delete(id);
      return next;
    });
  }
  /** Clique num quadrado da faixa "Hoje": abre as tarefas de hoje do plano e leva a tela até ele. */
  function goToPlan(id: string) {
    toggleToday(id, true);
    window.setTimeout(() => sectionRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
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
      <TodayStrip plans={shown.filter((p) => p.planActive)} tasksOf={tasksOf} onGo={goToPlan} />

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

      {shown.map((p) => (
        <PlanSection
          key={p.id}
          card={p}
          tasks={tasksOf(p.id)}
          column={columnOf(p)}
          open={!collapsed.has(p.id)}
          todayOpen={todayOpen.has(p.id)}
          onToggleOpen={() => toggleCollapsed(p.id)}
          onToggleToday={() => toggleToday(p.id)}
          onOpenCard={() => onOpenCard(p.id)}
          registerRef={(el) => { if (el) sectionRefs.current.set(p.id, el); else sectionRefs.current.delete(p.id); }}
        />
      ))}
    </div>
  );
}

// ── quadrado de hoje ───────────────────────────────────────────────────────────────────────────

/** Texto curto da situação de hoje quando não há quadrado pra marcar. */
function offLabel(t: TodayInfo): string | null {
  if (t.state === 'off') return 'folga hoje';
  if (t.state === 'before') return `começa em ${t.startsOn ? fmtShortDate(t.startsOn) : '?'}`;
  if (t.state === 'after') return 'encerrado';
  if (t.state === 'nodates') return 'sem datas';
  return null;
}

function TodaySquare({ info, size, onClick }: { info: TodayInfo; size: number; onClick?: () => void }) {
  const color = TODAY_COLORS[info.color];
  const label = `Hoje — ${TODAY_LABEL[info.color]}${info.total > 0 ? ` (${info.done}/${info.total})` : ''}${info.title ? ` — ${info.title}` : ''}`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={color ? 'border-0 cursor-pointer p-0' : 'bg-neutral-300 dark:bg-neutral-700 border-0 cursor-pointer p-0'}
      style={{ width: size, height: size, borderRadius: Math.max(3, Math.round(size / 6)), background: color ?? undefined, outline: '1px solid #6366f1', outlineOffset: 1, flexShrink: 0 }}
    />
  );
}

// ── faixa "Hoje" ───────────────────────────────────────────────────────────────────────────────

function TodayStrip({ plans, tasksOf, onGo }: { plans: KanbanCard[]; tasksOf: (id: string) => TaskRow[]; onGo: (id: string) => void }) {
  const rows = plans
    .map((p) => ({ p, info: todayInfo(p, new Set(tasksOf(p.id).map((t) => t.id))) }))
    .filter((r) => r.info.state === 'active' || r.info.state === 'notasks');
  if (rows.length === 0) return null; // nenhum plano com dia previsto hoje

  const doneCount = rows.filter((r) => r.info.color === 'green').length;
  return (
    <div className="border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900" style={{ padding: '8px 10px', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, fontWeight: 700, display: 'flex', gap: 8 }}>
        <span>Hoje</span>
        <span style={{ fontWeight: 400 }}>{doneCount} de {rows.length} planos completos</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {rows.map(({ p, info }) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onGo(p.id)}
            title={`${p.title}${info.title ? ` — ${info.title}` : ''} · ${info.done}/${info.total}`}
            className="bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 cursor-pointer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 4px', borderRadius: 6, fontSize: 11, maxWidth: 240 }}
          >
            <span
              className={TODAY_COLORS[info.color] ? '' : 'bg-neutral-300 dark:bg-neutral-700'}
              style={{ width: 16, height: 16, borderRadius: 3, background: TODAY_COLORS[info.color] ?? undefined, flexShrink: 0 }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.title || p.title}</span>
            <span className="text-neutral-500 dark:text-neutral-400" style={{ flexShrink: 0 }}>{info.done}/{info.total}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── um plano ───────────────────────────────────────────────────────────────────────────────────

function PlanSection({ card, tasks, column, open, todayOpen, onToggleOpen, onToggleToday, onOpenCard, registerRef }: {
  card: KanbanCard;
  tasks: TaskRow[];
  column: KanbanColumn | null;
  open: boolean;
  todayOpen: boolean;
  onToggleOpen: () => void;
  onToggleToday: () => void;
  onOpenCard: () => void;
  registerRef: (el: HTMLElement | null) => void;
}) {
  // UMA cópia local dos checks/títulos pra o cabeçalho, o painel de hoje e o gráfico não divergirem
  const { card: live, persist } = usePlanPersist(card);
  const taskIds = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks]);
  const today = todayInfo(live, taskIds);
  const markable = today.state === 'active' || today.state === 'notasks';
  const faint = 'text-neutral-500 dark:text-neutral-400';

  const doneIds = (live.planDayChecks?.[today.date] ?? []).filter((id) => taskIds.has(id));
  function setTodayIds(ids: string[]) {
    const next = { ...(live.planDayChecks ?? {}) };
    if (ids.length > 0) next[today.date] = ids; else delete next[today.date];
    persist({ planDayChecks: next });
  }
  function setTodayTitle(t: string) {
    const next = { ...(live.planDayTitles ?? {}) };
    if (t) next[today.date] = t; else delete next[today.date];
    persist({ planDayTitles: next });
  }

  const off = offLabel(today);

  return (
    <section ref={registerRef} style={{ opacity: card.planActive ? 1 : 0.7, scrollMarginTop: 8 }}>
      <div
        className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: open || todayOpen ? '6px 6px 0 0' : 6 }}
      >
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          title={open ? 'Recolher' : 'Expandir'}
          className="text-neutral-700 dark:text-neutral-200 bg-transparent border-0 cursor-pointer"
          style={{ fontSize: 12, padding: 0 }}
        >
          {open ? '▾' : '▸'}
        </button>
        {card.coverPath && (
          <img src={convertFileSrc(card.coverPath)} alt="" title="Capa do card" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
        )}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span className="text-neutral-900 dark:text-neutral-100" style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={card.title}>
            {card.title}{!card.planActive && <span className={faint} style={{ fontWeight: 400, fontSize: 11 }}> · inativo</span>}
          </span>
          {today.title && markable && (
            <span className={faint} style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={today.title}>Hoje: {today.title}</span>
          )}
        </span>
        {!open && <PlanDistributionBar card={live} inline open={false} onToggle={() => { }} hideToggle />}

        {/* quadrado de hoje */}
        {markable ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <TodaySquare info={today} size={22} onClick={onToggleToday} />
            <span className={faint} style={{ fontSize: 11 }} title="Tarefas feitas hoje">{today.done}/{today.total}</span>
          </span>
        ) : (
          off && (
            <span className={`${faint} border border-dashed border-neutral-300 dark:border-neutral-600`} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>{off}</span>
          )
        )}

        {column && <ColumnChip column={column} />}
        <button type="button" onClick={onOpenCard} title="Abrir o card" aria-label="Abrir o card" className={`${faint} bg-transparent border-0 cursor-pointer`} style={{ fontSize: 13 }}>↗</button>
      </div>

      {markable && todayOpen && (
        <div className="border-x border-b border-neutral-200 dark:border-neutral-700" style={{ padding: 8 }}>
          <PlanDayPanel
            date={today.date}
            tasks={tasks}
            doneIds={doneIds}
            title={today.title}
            statusLabel={TODAY_LABEL[today.color]}
            onToggle={(id) => setTodayIds(doneIds.includes(id) ? doneIds.filter((x) => x !== id) : [...doneIds, id])}
            onSetAll={setTodayIds}
            onTitle={setTodayTitle}
            onClose={onToggleToday}
          />
        </div>
      )}

      {open && (
        <div
          className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-600"
          style={{ padding: 8, borderRadius: '0 0 6px 6px', borderTop: todayOpen && markable ? undefined : 'none', boxSizing: 'border-box' }}
        >
          <PlanTracker card={live} onUpdate={persist} />
        </div>
      )}
    </section>
  );
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
