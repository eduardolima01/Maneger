import { useMemo, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
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
}

type Granularity = 'month' | 'week' | 'day';

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

/** 'YYYY-MM-DD' a partir de componentes locais — evita o shift de fuso horário de `new Date(isoString)`. */
function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateKeyFromDate(d: Date): string {
  return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
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

/** Linha de detalhe usada nas visões de semana e dia — bem mais informação que o chip compacto do mês. */
function CardDetailCard({
  card, column, checklistProgress, onCardClick,
}: {
  card: KanbanCard;
  column: KanbanColumn | undefined;
  checklistProgress?: ChecklistProgress;
  onCardClick: (cardId: string) => void;
}) {
  return (
    <div
      onClick={() => onCardClick(card.id)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
        backgroundColor: card.color ?? '#f7f7f7',
        borderLeft: `4px solid ${column?.color ?? '#999'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {column?.coverPath && (
          <img
            src={convertFileSrc(column.coverPath)}
            alt=""
            style={{ width: 18, height: 18, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.title}
        </span>
        {card.status && (
          <span
            style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 10, color: '#fff', flexShrink: 0,
              backgroundColor: STATUS_COLORS[card.status],
            }}
          >
            {STATUS_LABELS[card.status]}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 11, color: '#666' }}>
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
                style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, backgroundColor: parsed.color, color: '#fff' }}
              >
                {parsed.name}
              </span>
            );
          })}
          {card.labels.length > 4 && <span style={{ fontSize: 10, color: '#999' }}>+{card.labels.length - 4}</span>}
        </div>
      )}

      {card.description && (
        <p style={{ fontSize: 11, color: '#888', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {card.description}
        </p>
      )}
    </div>
  );
}

export default function KanbanCalendarView({ cards, columns, groups, checklistProgress, onCardClick }: KanbanCalendarViewProps) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [granularity, setGranularity] = useState<Granularity>('month');

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const columnById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  const cardsByDate = useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    for (const card of cards) {
      if (card.archived) continue;
      const key = cardDateKey(card);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(card);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [cards]);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, backgroundColor: '#fff', padding: 8, borderRadius: 8, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="secondary" onClick={goPrev}>‹</Button>
          <span style={{ fontSize: 15, fontWeight: 600, minWidth: 180, textAlign: 'center' }}>
            {periodLabel}
          </span>
          <Button variant="secondary" onClick={goNext}>›</Button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden' }}>
            {(['month', 'week', 'day'] as Granularity[]).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                style={{
                  padding: '6px 12px', fontSize: 12, border: 'none', cursor: 'pointer',
                  backgroundColor: granularity === g ? '#1a73e8' : '#fff',
                  color: granularity === g ? '#fff' : '#666',
                }}
              >
                {g === 'month' ? 'Mês' : g === 'week' ? 'Semana' : 'Dia'}
              </button>
            ))}
          </div>
          <Button variant="secondary" onClick={goToday}>Hoje</Button>
        </div>
      </div>

      {columnsInUse.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10, padding: '6px 8px', backgroundColor: '#fafafa', borderRadius: 6 }}>
          {columnsInUse.map((col) => (
            <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#555' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, backgroundColor: '#eee', border: '1px solid #eee' }}>
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              style={{ backgroundColor: '#fafafa', padding: '6px 4px', fontSize: 11, fontWeight: 600, color: '#666', textAlign: 'center' }}
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
                <div
                  key={`${wi}-${di}`}
                  style={{
                    backgroundColor: '#fff',
                    minHeight: 96,
                    padding: 4,
                    opacity: cell.inCurrentMonth ? 1 : 0.45,
                    outline: isToday ? '2px solid #1a73e8' : 'none',
                    outlineOffset: -2,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: isToday ? '#1a73e8' : '#999',
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
                        <div
                          key={card.id}
                          onClick={() => onCardClick(card.id)}
                          title={
                            [card.title, column?.name, card.status ? STATUS_LABELS[card.status] : null]
                              .filter(Boolean)
                              .join(' — ')
                          }
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 4,
                            fontSize: 11,
                            padding: '3px 5px',
                            borderRadius: 3,
                            cursor: 'pointer',
                            backgroundColor: card.color ?? '#f0f0f0',
                            borderLeft: `3px solid ${column?.color ?? '#999'}`,
                            overflow: 'hidden',
                          }}
                        >
                          {column?.coverPath && (
                            <img
                              src={convertFileSrc(column.coverPath)}
                              alt=""
                              style={{ width: 14, height: 14, borderRadius: 2, objectFit: 'cover', flexShrink: 0, marginTop: 1 }}
                            />
                          )}
                          <span
                            title={card.status ? STATUS_LABELS[card.status] : undefined}
                            style={{
                              width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 3,
                              backgroundColor: card.status ? STATUS_COLORS[card.status] : 'transparent',
                              border: card.status ? 'none' : '1px solid #bbb',
                            }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, flex: 1 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                              {card.title}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {column && (
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9, color: '#666' }}>
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
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {granularity === 'week' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {weekDays.map((d) => {
            const key = dateKeyFromDate(d);
            const dayCards = cardsByDate.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                style={{
                  backgroundColor: '#fff', borderRadius: 8, padding: 8, minHeight: 200,
                  outline: isToday ? '2px solid #1a73e8' : '1px solid #eee', outlineOffset: -2,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? '#1a73e8' : '#666', marginBottom: 6, textAlign: 'center' }}>
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
                        checklistProgress={checklistProgress?.[card.id]}
                        onCardClick={onCardClick}
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
          <div style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayCards.length === 0 ? (
              <p style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 24, margin: 0 }}>
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
                    checklistProgress={checklistProgress?.[card.id]}
                    onCardClick={onCardClick}
                  />
                );
              })
            )}
          </div>
        );
      })()}

      {!hasAnyDatedCard && (
        <p style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 24 }}>
          Nenhum card com data neste kanban ainda. Adicione uma data de início ou prazo a um card pra vê-lo aqui.
        </p>
      )}
    </div>
  );
}
