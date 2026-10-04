import { useEffect, useMemo, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Button from '@/components/layout/Button';
import { parseLabel } from '@/Kanban/utils/kanbanLabels';
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS } from '@/types/kanban.types';
import type { KanbanCard, KanbanColumn, KanbanCardGroup, ChecklistProgress } from '@/types/kanban.types';

interface KanbanCalendarViewProps {
  cards: KanbanCard[];
  columns: KanbanColumn[];
  groups: KanbanCardGroup[];
  checklistProgress?: Record<string, ChecklistProgress>;
  onCardClick: (cardId: string) => void;

  /** Liga/desliga a geração de ocorrências virtuais de um plano (ocorrências já materializadas não somem). */
  onTogglePlanActive: (planId: string, active: boolean) => void;
  /**
   * Clique numa ocorrência VIRTUAL (dia/repetição do plano ainda não editada): materializa
   * ela num card real e então abre pra edição — é o único momento em que um card nasce a
   * partir de um plano.
   */
  onVirtualOccurrenceClick: (planId: string, date: string, occurrenceIndex: number) => void;

  /**
   * Arrastar um card pra outro dia no calendário (visão de mês). Se o card tiver as duas datas
   * (startDate e dueDate formando um intervalo), as duas são deslocadas pelo mesmo tanto de dias,
   * pra preservar o tamanho do intervalo — não só "esticar" a data que caiu embaixo do cursor.
   * Ocorrência virtual de plano não é arrastável (não existe como card de verdade ainda).
   */
  onChangeCardDate: (cardId: string, updates: { startDate?: string; dueDate?: string }) => void;

  /** Escopo do estado salvo da visualização (ex.: id do kanban). Sem isso, todos os kanbans compartilham o mesmo estado salvo. */
  stateKey?: string;
}

type Granularity = 'month' | 'week' | 'day';

interface SavedViewState {
  granularity: Granularity;
  cursor: string; // 'YYYY-MM-DD'
  plansPanelOpen: boolean;
}

const VIEW_STATE_PREFIX = 'kanban-calendar-view:';

function loadViewState(stateKey: string): SavedViewState | null {
  try {
    const raw = localStorage.getItem(VIEW_STATE_PREFIX + stateKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedViewState>;
    const granularity: Granularity =
      parsed.granularity === 'week' || parsed.granularity === 'day' ? parsed.granularity : 'month';
    const cursorOk = typeof parsed.cursor === 'string' && !Number.isNaN(new Date(`${parsed.cursor}T00:00:00`).getTime());
    if (!cursorOk) return null;
    return { granularity, cursor: parsed.cursor as string, plansPanelOpen: !!parsed.plansPanelOpen };
  } catch {
    return null;
  }
}

function saveViewState(stateKey: string, state: SavedViewState) {
  try {
    localStorage.setItem(VIEW_STATE_PREFIX + stateKey, JSON.stringify(state));
  } catch {
    // sem storage disponível — só não persiste
  }
}

interface CalendarCell {
  day: number;
  year: number;
  month: number;
  inCurrentMonth: boolean;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const VIRTUAL_ID_PREFIX = 'virtual:';

function makeVirtualId(planId: string, date: string, occurrenceIndex: number): string {
  return `${VIRTUAL_ID_PREFIX}${planId}:${date}:${occurrenceIndex}`;
}

/** Desmonta um id virtual de volta em (planId, date, occurrenceIndex). Assume que já passou por isVirtualCard. */
function parseVirtualId(id: string): { planId: string; date: string; occurrenceIndex: number } {
  const rest = id.slice(VIRTUAL_ID_PREFIX.length);
  const lastColon = rest.lastIndexOf(':');
  const occurrenceIndex = Number(rest.slice(lastColon + 1));
  const rest2 = rest.slice(0, lastColon);
  const secondLastColon = rest2.lastIndexOf(':');
  const date = rest2.slice(secondLastColon + 1);
  const planId = rest2.slice(0, secondLastColon);
  return { planId, date, occurrenceIndex };
}

function isVirtualCard(card: KanbanCard): boolean {
  return card.id.startsWith(VIRTUAL_ID_PREFIX);
}

/** 'YYYY-MM-DD' a partir de componentes locais — evita o shift de fuso horário de `new Date(isoString)`. */
function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateKeyFromDate(d: Date): string {
  return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Todas as datas ('YYYY-MM-DD') entre start e end, inclusive, em ordem. */
function enumerateDates(start: string, end: string): string[] {
  const result: string[] = [];
  let cursor = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (cursor > endDate) return result; // intervalo invertido — não gera nada
  while (cursor <= endDate) {
    result.push(dateKeyFromDate(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  return result;
}

/** Diferença em dias inteiros entre duas chaves 'YYYY-MM-DD' (toKey - fromKey). Usada pra arrastar card entre dias. */
function daysBetweenKeys(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T00:00:00`);
  const to = new Date(`${toKey}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/** Desloca uma chave 'YYYY-MM-DD' por N dias (pode ser negativo). */
function shiftDateKey(key: string, deltaDays: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return dateKeyFromDate(d);
}

/**
 * Data "efetiva" do card no calendário: prioriza `dueDate`, cai pra `startDate`
 * se não tiver prazo. Cards sem nenhuma das duas ficam ocultos (decisão do usuário).
 */
function cardDateKey(card: KanbanCard): string | null {
  const raw = card.dueDate ?? card.startDate;
  return raw ? raw.slice(0, 10) : null;
}

/** Resolve o columnId "efetivo" do card — se ele estiver dentro de um grupo, a coluna é a do grupo. */
function resolveColumnId(card: KanbanCard, groups: KanbanCardGroup[]): string | null {
  if (card.columnId) return card.columnId;
  if (card.cardGroupId) {
    const group = groups.find((g) => g.id === card.cardGroupId);
    return group?.columnId ?? null;
  }
  return null;
}

/**
 * Capa do grupo "pai" de um card de plano (ocorrência virtual ou já materializada).
 * Grupo = o do card (cardGroupId) ou, na ocorrência virtual, o grupo-alvo do plano (planTargetGroupId).
 * Se esse grupo não tiver capa, sobe pelos grupos-pai até achar uma.
 */
function resolveGroupCoverPath(card: KanbanCard, groups: KanbanCardGroup[]): string | null {
  if (!card.planParentId) return null; // só card de plano
  let groupId: string | null = card.cardGroupId ?? card.planTargetGroupId ?? null;
  const seen = new Set<string>();
  while (groupId && !seen.has(groupId)) {
    seen.add(groupId);
    const group = groups.find((g) => g.id === groupId);
    if (!group) return null;
    if (group.coverPath) return group.coverPath;
    groupId = group.parentGroupId ?? null;
  }
  return null;
}

function buildWeeks(year: number, month: number): CalendarCell[][] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0 = domingo
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextMonthYear = month === 11 ? year + 1 : year;

  const cells: CalendarCell[] = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, year: prevMonthYear, month: prevMonth, inCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, year, month, inCurrentMonth: true });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay, year: nextMonthYear, month: nextMonth, inCurrentMonth: false });
    nextDay++;
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Os 7 dias (dom→sáb) da semana que contém `cursor`. */
function buildWeekDays(cursor: Date): Date[] {
  const start = new Date(cursor);
  start.setDate(cursor.getDate() - cursor.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Célula de dia da visão de mês, como alvo de soltar um card arrastado (id = 'YYYY-MM-DD'). */
function DroppableDayCell({
  id, isToday, inCurrentMonth, children,
}: {
  id: string;
  isToday: boolean;
  inCurrentMonth: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={[
        isOver ? 'bg-blue-50 dark:bg-blue-950' : 'bg-white dark:bg-neutral-800',
        isToday
          ? 'outline outline-2 outline-blue-600 dark:outline-blue-400'
          : (isOver ? 'outline-2 outline-dashed outline-blue-600 dark:outline-blue-400' : ''),
      ].join(' ')}
      style={{
        minHeight: 96,
        minWidth: 0,
        padding: 4,
        opacity: inCurrentMonth ? 1 : 0.45,
        outlineOffset: -2,
      }}
    >
      {children}
    </div>
  );
}

/** Chip compacto de card na visão de mês, arrastável pra outro dia. Ocorrência virtual fica só clicável (disabled). */
function DraggableMonthChip({
  card, column, groupCoverPath, onClick,
}: {
  card: KanbanCard;
  column: KanbanColumn | undefined;
  groupCoverPath?: string | null;
  onClick: () => void;
}) {
  const virtual = isVirtualCard(card);
  // Card com cor própria (escolhida pelo usuário) mantém texto escuro fixo nos dois temas.
  const hasColor = !virtual && !!card.color;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id, disabled: virtual });

  return (
    <div
      ref={setNodeRef}
      {...(virtual ? {} : attributes)}
      {...(virtual ? {} : listeners)}
      onClick={onClick}
      title={
        virtual
          ? `${card.title} — ocorrência de plano ainda não editada (clique pra criar)`
          : [card.title, column?.name, card.status ? STATUS_LABELS[card.status] : null].filter(Boolean).join(' — ')
      }
      className={
        virtual
          ? 'border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300'
          : (hasColor ? 'text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100')
      }
      style={{
        transform: CSS.Translate.toString(transform),
        position: transform ? 'relative' : undefined,
        zIndex: isDragging ? 50 : undefined,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 4,
        fontSize: 11,
        padding: '3px 5px',
        borderRadius: 3,
        cursor: virtual ? 'pointer' : 'grab',
        ...(virtual ? {} : {
          backgroundColor: card.color ?? undefined,
          borderLeft: `3px solid ${column?.color ?? '#999'}`,
        }),
        opacity: isDragging ? 0.35 : (virtual ? 0.6 : 1),
        overflow: 'hidden',
      }}
    >
      {virtual && <span style={{ fontSize: 9, flexShrink: 0 }}>📋</span>}
      {column?.coverPath && (
        <img
          src={convertFileSrc(column.coverPath)}
          alt=""
          style={{ width: 14, height: 14, borderRadius: 2, objectFit: 'cover', flexShrink: 0, marginTop: 1 }}
        />
      )}
      {groupCoverPath && (
        <img
          src={convertFileSrc(groupCoverPath)}
          alt=""
          title="Capa do grupo"
          style={{ width: 14, height: 14, borderRadius: 2, objectFit: 'cover', flexShrink: 0, marginTop: 1 }}
        />
      )}
      {card.coverPath && (
        <img
          src={convertFileSrc(card.coverPath)}
          alt=""
          title="Capa do card"
          style={{ width: 14, height: 14, borderRadius: 2, objectFit: 'cover', flexShrink: 0, marginTop: 1 }}
        />
      )}
      <span
        title={card.status ? STATUS_LABELS[card.status] : undefined}
        className={card.status ? '' : 'border border-neutral-400 dark:border-neutral-500'}
        style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 3,
          backgroundColor: card.status ? STATUS_COLORS[card.status] : 'transparent',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, flex: 1 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {card.title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {column && (
            <span
              className={hasColor ? 'text-neutral-600' : 'text-neutral-500 dark:text-neutral-400'}
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9 }}
            >
              {column.name}
            </span>
          )}
          {card.priority && (
            <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, backgroundColor: PRIORITY_COLORS[card.priority] }} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Linha de detalhe usada nas visões de semana e dia — bem mais informação que o chip compacto do mês. */
function CardDetailCard({
  card, column, groupCoverPath, checklistProgress, isVirtual, onClick,
}: {
  card: KanbanCard;
  column: KanbanColumn | undefined;
  groupCoverPath?: string | null;
  checklistProgress?: ChecklistProgress;
  isVirtual: boolean;
  onClick: () => void;
}) {
  // Card com cor própria (escolhida pelo usuário) mantém texto escuro fixo nos dois temas.
  const hasColor = !isVirtual && !!card.color;
  const mutedClass = hasColor ? 'text-neutral-600' : 'text-neutral-500 dark:text-neutral-400';
  const faintClass = hasColor ? 'text-neutral-500' : 'text-neutral-400 dark:text-neutral-500';
  return (
    <div
      onClick={onClick}
      className={
        isVirtual
          ? 'border-[1.5px] border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300'
          : (hasColor ? 'text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100')
      }
      title={isVirtual ? 'Ocorrência de plano ainda não editada — clique pra criar e editar' : undefined}
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
        ...(isVirtual ? {} : {
          backgroundColor: card.color ?? undefined,
          borderLeft: `4px solid ${column?.color ?? '#999'}`,
        }),
        opacity: isVirtual ? 0.65 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isVirtual && <span title="Ocorrência de plano ainda não criada" style={{ fontSize: 12 }}>📋</span>}
        {column?.coverPath && (
          <img
            src={convertFileSrc(column.coverPath)}
            alt=""
            style={{ width: 18, height: 18, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        {groupCoverPath && (
          <img
            src={convertFileSrc(groupCoverPath)}
            alt=""
            title="Capa do grupo"
            style={{ width: 18, height: 18, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        {card.coverPath && (
          <img
            src={convertFileSrc(card.coverPath)}
            alt=""
            title="Capa do card"
            style={{ width: 24, height: 24, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.title}
        </span>
        {!isVirtual && card.planParentId && (
          <span title="Nasceu de um plano" style={{ fontSize: 11 }}>📋</span>
        )}
        {card.status && (
          <span
            className="text-white"
            style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 10, flexShrink: 0,
              backgroundColor: STATUS_COLORS[card.status],
            }}
          >
            {STATUS_LABELS[card.status]}
          </span>
        )}
      </div>

      <div className={mutedClass} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 11 }}>
        {column && <span>{column.name}</span>}

        {card.priority && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: PRIORITY_COLORS[card.priority] }} />
            {PRIORITY_LABELS[card.priority]}
          </span>
        )}

        {checklistProgress && checklistProgress.total > 0 && (
          <span>☑ {checklistProgress.done}/{checklistProgress.total}</span>
        )}

        {card.startDate && card.dueDate && card.startDate !== card.dueDate && (
          <span>{card.startDate.slice(8, 10)}/{card.startDate.slice(5, 7)} → {card.dueDate.slice(8, 10)}/{card.dueDate.slice(5, 7)}</span>
        )}
      </div>

      {card.labels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {card.labels.slice(0, 4).map((label) => {
            const parsed = parseLabel(label);
            return (
              <span
                key={label}
                className="text-white"
                style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, backgroundColor: parsed.color }}
              >
                {parsed.name}
              </span>
            );
          })}
          {card.labels.length > 4 && <span className={faintClass} style={{ fontSize: 10 }}>+{card.labels.length - 4}</span>}
        </div>
      )}

      {card.description && (
        <p className={mutedClass} style={{ fontSize: 11, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {card.description}
        </p>
      )}
    </div>
  );
}

export default function KanbanCalendarView({
  cards, columns, groups, checklistProgress, onCardClick,
  onTogglePlanActive, onVirtualOccurrenceClick, onChangeCardDate, stateKey = 'default',
}: KanbanCalendarViewProps) {
  const today = new Date();
  const [saved] = useState(() => loadViewState(stateKey));
  const [cursor, setCursor] = useState(() =>
    saved ? new Date(`${saved.cursor}T00:00:00`) : new Date(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const [granularity, setGranularity] = useState<Granularity>(saved?.granularity ?? 'month');
  const [plansPanelOpen, setPlansPanelOpen] = useState(saved?.plansPanelOpen ?? false);

  // Salva a visualização (período, granularidade, painel de planos) a cada mudança.
  useEffect(() => {
    saveViewState(stateKey, { granularity, cursor: dateKeyFromDate(cursor), plansPanelOpen });
  }, [stateKey, granularity, cursor, plansPanelOpen]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const columnById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  // Card-modelo de plano é só config — mora numa coluna do board, mas não entra na grade
  // do calendário como "um card nesse dia" (quem entra são as ocorrências, virtuais ou reais).
  const planTemplates = useMemo(() => cards.filter((c) => c.isPlanTemplate), [cards]);
  const nonTemplateCards = useMemo(() => cards.filter((c) => !c.isPlanTemplate), [cards]);

  // planId -> chaves 'YYYY-MM-DD:índice' já materializadas (cards reais nascidos daquele plano).
  const materializedKeysByPlan = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of nonTemplateCards) {
      if (!c.planParentId) continue;
      const dateStr = cardDateKey(c);
      if (!dateStr) continue;
      const idx = c.planOccurrenceIndex ?? 0;
      const set = map.get(c.planParentId) ?? new Set<string>();
      set.add(`${dateStr}:${idx}`);
      map.set(c.planParentId, set);
    }
    return map;
  }, [nonTemplateCards]);

  // Ocorrências virtuais: uma repetição (dia + índice) do intervalo de um plano ATIVO, no dia
  // da semana certo, que ainda não foi materializada. Nunca salvas — recalculadas a cada
  // render a partir do card-modelo.
  const virtualOccurrences = useMemo(() => {
    const list: KanbanCard[] = [];
    for (const plan of planTemplates) {
      if (!plan.planActive || !plan.startDate || !plan.dueDate) continue;
      const weekdays = plan.planWeekdays.length > 0 ? plan.planWeekdays : [0, 1, 2, 3, 4, 5, 6];
      const timesPerDay = Math.max(1, plan.planTimesPerDay);
      const materializedKeys = materializedKeysByPlan.get(plan.id) ?? new Set<string>();

      for (const dateStr of enumerateDates(plan.startDate.slice(0, 10), plan.dueDate.slice(0, 10))) {
        const weekday = new Date(`${dateStr}T00:00:00`).getDay();
        if (!weekdays.includes(weekday)) continue;

        for (let idx = 0; idx < timesPerDay; idx++) {
          if (materializedKeys.has(`${dateStr}:${idx}`)) continue;
          list.push({
            ...plan,
            id: makeVirtualId(plan.id, dateStr, idx),
            isPlanTemplate: false,
            planActive: false,
            planParentId: plan.id,
            planOccurrenceIndex: idx,
            startDate: dateStr,
            dueDate: dateStr,
            title: timesPerDay > 1 ? `${plan.title} (${idx + 1}/${timesPerDay})` : plan.title,
          });
        }
      }
    }
    return list;
  }, [planTemplates, materializedKeysByPlan]);

  const cardsByDate = useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    for (const card of [...nonTemplateCards, ...virtualOccurrences]) {
      if (card.archived) continue;
      const key = cardDateKey(card);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(card);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [nonTemplateCards, virtualOccurrences]);

  const weeks = useMemo(() => buildWeeks(year, month), [year, month]);
  const weekDays = useMemo(() => buildWeekDays(cursor), [cursor]);
  const todayKey = dateKeyFromDate(today);
  const hasAnyDatedCard = cardsByDate.size > 0;

  /** Colunas que têm pelo menos um card com data — base da legenda de identificação. */
  const columnsInUse = useMemo(() => {
    const idsInUse = new Set<string>();
    for (const list of cardsByDate.values()) {
      for (const card of list) {
        const columnId = resolveColumnId(card, groups);
        if (columnId) idsInUse.add(columnId);
      }
    }
    return columns.filter((c) => idsInUse.has(c.id));
  }, [cardsByDate, groups, columns]);

  function handleCardClick(card: KanbanCard) {
    if (isVirtualCard(card)) {
      const { planId, date, occurrenceIndex } = parseVirtualId(card.id);
      onVirtualOccurrenceClick(planId, date, occurrenceIndex);
    } else {
      onCardClick(card.id);
    }
  }

  /** Soltou um card em cima de outro dia na visão de mês — desloca startDate/dueDate (as que existirem) pelo mesmo delta. */
  function handleCalendarDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const cardId = active.id as string;
    const newDateKey = over.id as string;
    const card = nonTemplateCards.find((c) => c.id === cardId);
    if (!card) return; // defesa: virtual não deveria nem estar arrastável (disabled), mas por garantia

    const effectiveKey = cardDateKey(card);
    if (!effectiveKey || effectiveKey === newDateKey) return;

    const deltaDays = daysBetweenKeys(effectiveKey, newDateKey);
    const updates: { startDate?: string; dueDate?: string } = {};
    if (card.startDate) updates.startDate = shiftDateKey(card.startDate.slice(0, 10), deltaDays);
    if (card.dueDate) updates.dueDate = shiftDateKey(card.dueDate.slice(0, 10), deltaDays);
    onChangeCardDate(cardId, updates);
  }

  function goPrev() {
    if (granularity === 'month') setCursor(new Date(year, month - 1, 1));
    else if (granularity === 'week') setCursor(new Date(year, month, cursor.getDate() - 7));
    else setCursor(new Date(year, month, cursor.getDate() - 1));
  }

  function goNext() {
    if (granularity === 'month') setCursor(new Date(year, month + 1, 1));
    else if (granularity === 'week') setCursor(new Date(year, month, cursor.getDate() + 7));
    else setCursor(new Date(year, month, cursor.getDate() + 1));
  }

  function goToday() {
    setCursor(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  }

  const periodLabel = useMemo(() => {
    if (granularity === 'month') return `${MONTH_LABELS[month]} ${year}`;
    if (granularity === 'day') return `${cursor.getDate()} de ${MONTH_LABELS[month]} de ${year}`;
    const start = weekDays[0];
    const end = weekDays[6];
    const sameMonth = start.getMonth() === end.getMonth();
    return sameMonth
      ? `${start.getDate()} – ${end.getDate()} de ${MONTH_LABELS[start.getMonth()]} ${start.getFullYear()}`
      : `${start.getDate()} ${MONTH_LABELS[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTH_LABELS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
  }, [granularity, month, year, cursor, weekDays]);

  return (
    <div>
      <div className="bg-white dark:bg-neutral-800" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: 8, borderRadius: 8, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="secondary" onClick={goPrev}>‹</Button>
          <span className="text-neutral-900 dark:text-neutral-100" style={{ fontSize: 15, fontWeight: 600, minWidth: 180, textAlign: 'center' }}>
            {periodLabel}
          </span>
          <Button variant="secondary" onClick={goNext}>›</Button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="border border-neutral-300 dark:border-neutral-600" style={{ display: 'flex', borderRadius: 6, overflow: 'hidden' }}>
            {(['month', 'week', 'day'] as Granularity[]).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={
                  granularity === g
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                }
                style={{ padding: '6px 12px', fontSize: 12, border: 'none', cursor: 'pointer' }}
              >
                {g === 'month' ? 'Mês' : g === 'week' ? 'Semana' : 'Dia'}
              </button>
            ))}
          </div>
          <Button variant="secondary" onClick={goToday}>Hoje</Button>
          {planTemplates.length > 0 && (
            <Button variant="secondary" onClick={() => setPlansPanelOpen((v) => !v)}>
              📋 Planos ({planTemplates.length})
            </Button>
          )}
        </div>
      </div>

      {plansPanelOpen && planTemplates.length > 0 && (
        <div className="bg-white dark:bg-neutral-800" style={{ borderRadius: 8, padding: 10, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {planTemplates.map((plan) => (
            <div key={plan.id} className="border border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6 }}>
              <span
                onClick={() => onCardClick(plan.id)}
                className="text-neutral-900 dark:text-neutral-100"
                style={{ flex: 1, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                title="Editar plano (o card-modelo está na coluna do board)"
              >
                {plan.title}
              </span>
              <span className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11 }}>
                {plan.startDate?.slice(8, 10)}/{plan.startDate?.slice(5, 7)} → {plan.dueDate?.slice(8, 10)}/{plan.dueDate?.slice(5, 7)}
                {plan.planTimesPerDay > 1 ? ` · ${plan.planTimesPerDay}x/dia` : ''}
              </span>
              <label className="text-neutral-900 dark:text-neutral-100" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={plan.planActive}
                  onChange={(e) => onTogglePlanActive(plan.id, e.target.checked)}
                />
                Ativo
              </label>
            </div>
          ))}
        </div>
      )}

      {columnsInUse.length > 0 && (
        <div className="bg-neutral-50 dark:bg-neutral-950" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10, padding: '6px 8px', borderRadius: 6 }}>
          {columnsInUse.map((col) => (
            <div key={col.id} className="text-neutral-600 dark:text-neutral-400" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              {col.coverPath ? (
                <img
                  src={convertFileSrc(col.coverPath)}
                  alt=""
                  style={{ width: 16, height: 16, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: col.color ?? '#999', flexShrink: 0 }} />
              )}
              {col.name}
            </div>
          ))}
        </div>
      )}

      {granularity === 'month' && (
        <DndContext sensors={sensors} onDragEnd={handleCalendarDragEnd}>
          <div
            className="bg-neutral-200 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-700"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1 }}
          >
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400"
                style={{ padding: '6px 4px', fontSize: 11, fontWeight: 600, textAlign: 'center' }}
              >
                {label}
              </div>
            ))}

            {weeks.flatMap((week, wi) =>
              week.map((cell, di) => {
                const key = dateKey(cell.year, cell.month, cell.day);
                const dayCards = cardsByDate.get(key) ?? [];
                const isToday = key === todayKey;
                return (
                  <DroppableDayCell key={`${wi}-${di}`} id={key} isToday={isToday} inCurrentMonth={cell.inCurrentMonth}>
                    <div
                      className={isToday ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 dark:text-neutral-500'}
                      style={{
                        fontSize: 11,
                        fontWeight: isToday ? 700 : 400,
                        marginBottom: 4,
                      }}
                    >
                      {cell.day}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {dayCards.map((card) => {
                        const columnId = resolveColumnId(card, groups);
                        const column = columnId ? columnById.get(columnId) : undefined;
                        return (
                          <DraggableMonthChip key={card.id} card={card} column={column} groupCoverPath={resolveGroupCoverPath(card, groups)} onClick={() => handleCardClick(card)} />
                        );
                      })}
                    </div>
                  </DroppableDayCell>
                );
              })
            )}
          </div>
        </DndContext>
      )}

      {granularity === 'week' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
          {weekDays.map((d) => {
            const key = dateKeyFromDate(d);
            const dayCards = cardsByDate.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={[
                  'bg-white dark:bg-neutral-800 outline',
                  isToday
                    ? 'outline-2 outline-blue-600 dark:outline-blue-400'
                    : 'outline-1 outline-neutral-200 dark:outline-neutral-700',
                ].join(' ')}
                style={{ borderRadius: 8, padding: 8, minHeight: 200, minWidth: 0, outlineOffset: -2 }}
              >
                <div
                  className={isToday ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500 dark:text-neutral-400'}
                  style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, textAlign: 'center' }}
                >
                  {WEEKDAY_LABELS[d.getDay()]} {d.getDate()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {dayCards.map((card) => {
                    const columnId = resolveColumnId(card, groups);
                    const column = columnId ? columnById.get(columnId) : undefined;
                    return (
                      <CardDetailCard
                        key={card.id}
                        card={card}
                        column={column}
                        groupCoverPath={resolveGroupCoverPath(card, groups)}
                        checklistProgress={checklistProgress?.[card.id]}
                        isVirtual={isVirtualCard(card)}
                        onClick={() => handleCardClick(card)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {granularity === 'day' && (() => {
        const key = dateKeyFromDate(cursor);
        const dayCards = cardsByDate.get(key) ?? [];
        return (
          <div className="bg-white dark:bg-neutral-800" style={{ borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayCards.length === 0 ? (
              <p className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 13, textAlign: 'center', padding: 24, margin: 0 }}>
                Nenhum card com data neste dia.
              </p>
            ) : (
              dayCards.map((card) => {
                const columnId = resolveColumnId(card, groups);
                const column = columnId ? columnById.get(columnId) : undefined;
                return (
                  <CardDetailCard
                    key={card.id}
                    card={card}
                    column={column}
                    groupCoverPath={resolveGroupCoverPath(card, groups)}
                    checklistProgress={checklistProgress?.[card.id]}
                    isVirtual={isVirtualCard(card)}
                    onClick={() => handleCardClick(card)}
                  />
                );
              })
            )}
          </div>
        );
      })()}

      {!hasAnyDatedCard && (
        <p className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 13, textAlign: 'center', padding: 24 }}>
          Nenhum card com data neste kanban ainda. Adicione uma data de início ou prazo a um card, ou crie um card de plano numa coluna, pra vê-lo aqui.
        </p>
      )}
    </div>
  );
}
