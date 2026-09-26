import { useMemo, useState } from 'react';
import type { KanbanCard, KanbanColumn, KanbanCardGroup } from '@/types/kanban.types';

interface UpcomingCardsPanelProps {
  cards: KanbanCard[];
  columns: KanbanColumn[];
  groups: KanbanCardGroup[];
  onCardClick: (cardId: string) => void;
  /** Clique numa ocorrência de plano ainda não materializada — mesma função usada pelo calendário. */
  onVirtualOccurrenceClick: (planId: string, date: string, occurrenceIndex: number) => void;
  onClose: () => void;
}

interface Moment {
  card: KanbanCard;
  time: Date;
  label: string | null; // título do horário (null = "dia inteiro", sem horário definido)
  isAllDay: boolean;
  /** Presente só pra ocorrência de plano ainda não materializada — card não existe de verdade ainda. */
  virtualRef: { planId: string; date: string; occurrenceIndex: number } | null;
}

// Janela de geração das ocorrências de plano ainda não criadas — sem isso, um plano de meses geraria
// milhares de ocorrências virtuais só pra achar as poucas perto de agora.
const PAST_WINDOW_DAYS = 14;
const FUTURE_WINDOW_DAYS = 60;

/** Coluna de um card — se ele estiver dentro de um grupo/subgrupo, sobe a cadeia de grupos até achar a coluna. */
function resolveColumnId(card: KanbanCard, groups: KanbanCardGroup[]): string | null {
  if (card.columnId) return card.columnId;
  let groupId = card.cardGroupId;
  const groupsById = new Map(groups.map((g) => [g.id, g]));
  while (groupId) {
    const group = groupsById.get(groupId);
    if (!group) return null;
    if (group.columnId) return group.columnId;
    groupId = group.parentGroupId;
  }
  return null;
}

function dateKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Todas as datas ('YYYY-MM-DD') entre start e end, inclusive, em ordem — mesmo helper do calendário. */
function enumerateDates(start: string, end: string): string[] {
  const result: string[] = [];
  let cursor = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (cursor > endDate) return result;
  while (cursor <= endDate) {
    result.push(dateKeyFromDate(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  return result;
}

function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(date: Date, now: Date): string {
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return 'Hoje';
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return 'Amanhã';
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function MomentRow({ moment, column, onClick }: { moment: Moment; column: KanbanColumn | undefined; onClick: () => void }) {
  const now = new Date();
  return (
    <div
      onClick={onClick}
      title={moment.virtualRef ? 'Ocorrência de plano ainda não editada (clique pra criar)' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6,
        border: moment.virtualRef ? '1px dashed #bbb' : '1px solid #eee', cursor: 'pointer',
        backgroundColor: moment.virtualRef ? 'transparent' : '#fff',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 52, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#333' }}>{formatDateLabel(moment.time, now)}</span>
        <span style={{ fontSize: 10, color: '#999' }}>{moment.isAllDay ? 'dia inteiro' : formatTimeLabel(moment.time)}</span>
      </div>
      <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: column?.color ?? '#ccc', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: moment.virtualRef ? 0.7 : 1 }}>
          {moment.virtualRef && '📋 '}{moment.card.title}
        </span>
        <span style={{ fontSize: 11, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {moment.label ? `${moment.label} · ` : ''}{column?.name ?? 'Sem coluna'}
        </span>
      </div>
    </div>
  );
}

/**
 * Painel lateral com os cards que têm data (dueDate, ou startDate quando não há dueDate) ordenados por
 * proximidade de AGORA, incluindo ocorrências de plano ainda não materializadas (mesma lógica do
 * calendário, numa janela de ±dias perto de agora). Card com horários (schedules) vira um "momento" por
 * horário — cada horário é uma coisa distinta a fazer numa hora específica; card sem horário vira um único
 * momento "dia inteiro" na data dele. Abas escolhem ver Atrasados OU Próximos (não os dois empilhados).
 */
export default function UpcomingCardsPanel({ cards, columns, groups, onCardClick, onVirtualOccurrenceClick, onClose }: UpcomingCardsPanelProps) {
  const columnById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const [tab, setTab] = useState<'upcoming' | 'overdue'>('upcoming');

  const { overdue, upcoming } = useMemo(() => {
    const now = new Date();
    const moments: Moment[] = [];

    const nonTemplateCards = cards.filter((c) => !c.isPlanTemplate && !c.archived);
    const planTemplates = cards.filter((c) => c.isPlanTemplate);

    for (const card of nonTemplateCards) {
      const effectiveDate = card.dueDate ?? card.startDate;
      if (!effectiveDate) continue;
      const datePart = effectiveDate.slice(0, 10);

      if (card.schedules && card.schedules.length > 0) {
        for (const s of card.schedules) {
          moments.push({ card, time: new Date(`${datePart}T${s.time}:00`), label: s.title || null, isAllDay: false, virtualRef: null });
        }
      } else {
        moments.push({ card, time: new Date(`${datePart}T00:00:00`), label: null, isAllDay: true, virtualRef: null });
      }
    }

    // Ocorrências de plano ainda não materializadas — mesma ideia de KanbanCalendarView.tsx, mas só
    // numa janela perto de agora (não o intervalo do plano inteiro, que pode ser meses).
    const windowStart = new Date(now); windowStart.setDate(now.getDate() - PAST_WINDOW_DAYS);
    const windowEnd = new Date(now); windowEnd.setDate(now.getDate() + FUTURE_WINDOW_DAYS);
    const windowStartKey = dateKeyFromDate(windowStart);
    const windowEndKey = dateKeyFromDate(windowEnd);

    const materializedKeysByPlan = new Map<string, Set<string>>();
    for (const c of nonTemplateCards) {
      if (!c.planParentId) continue;
      const dateStr = c.dueDate ?? c.startDate;
      if (!dateStr) continue;
      const idx = c.planOccurrenceIndex ?? 0;
      const set = materializedKeysByPlan.get(c.planParentId) ?? new Set<string>();
      set.add(`${dateStr.slice(0, 10)}:${idx}`);
      materializedKeysByPlan.set(c.planParentId, set);
    }

    for (const plan of planTemplates) {
      if (!plan.planActive || !plan.startDate || !plan.dueDate) continue;
      const weekdays = plan.planWeekdays.length > 0 ? plan.planWeekdays : [0, 1, 2, 3, 4, 5, 6];
      const timesPerDay = Math.max(1, plan.planTimesPerDay);
      const materializedKeys = materializedKeysByPlan.get(plan.id) ?? new Set<string>();

      const rangeStart = plan.startDate.slice(0, 10) > windowStartKey ? plan.startDate.slice(0, 10) : windowStartKey;
      const rangeEnd = plan.dueDate.slice(0, 10) < windowEndKey ? plan.dueDate.slice(0, 10) : windowEndKey;

      for (const dateStr of enumerateDates(rangeStart, rangeEnd)) {
        const weekday = new Date(`${dateStr}T00:00:00`).getDay();
        if (!weekdays.includes(weekday)) continue;

        for (let idx = 0; idx < timesPerDay; idx++) {
          if (materializedKeys.has(`${dateStr}:${idx}`)) continue;
          const virtualCard: KanbanCard = {
            ...plan,
            title: timesPerDay > 1 ? `${plan.title} (${idx + 1}/${timesPerDay})` : plan.title,
          };
          if (plan.schedules && plan.schedules.length > 0) {
            for (const s of plan.schedules) {
              moments.push({
                card: virtualCard, time: new Date(`${dateStr}T${s.time}:00`), label: s.title || null,
                isAllDay: false, virtualRef: { planId: plan.id, date: dateStr, occurrenceIndex: idx },
              });
            }
          } else {
            moments.push({
              card: virtualCard, time: new Date(`${dateStr}T00:00:00`), label: null,
              isAllDay: true, virtualRef: { planId: plan.id, date: dateStr, occurrenceIndex: idx },
            });
          }
        }
      }
    }

    const overdueList = moments.filter((m) => m.time < now).sort((a, b) => b.time.getTime() - a.time.getTime());
    const upcomingList = moments.filter((m) => m.time >= now).sort((a, b) => a.time.getTime() - b.time.getTime());
    return { overdue: overdueList, upcoming: upcomingList };
  }, [cards]);

  const list = tab === 'upcoming' ? upcoming : overdue;

  function handleClick(m: Moment) {
    if (m.virtualRef) onVirtualOccurrenceClick(m.virtualRef.planId, m.virtualRef.date, m.virtualRef.occurrenceIndex);
    else onCardClick(m.card.id);
  }

  return (
    <div
      style={{
        width: 320, flexShrink: 0, backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: 8,
        padding: 12, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '80vh', overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>🕐 Mais próximos</span>
        <button onClick={onClose} title="Fechar" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#999' }}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => setTab('upcoming')}
          style={{
            flex: 1, padding: '6px 4px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
            border: '1px solid ' + (tab === 'upcoming' ? '#1a73e8' : '#ddd'),
            backgroundColor: tab === 'upcoming' ? '#1a73e8' : '#fff', color: tab === 'upcoming' ? '#fff' : '#666',
          }}
        >
          Próximos ({upcoming.length})
        </button>
        <button
          onClick={() => setTab('overdue')}
          style={{
            flex: 1, padding: '6px 4px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
            border: '1px solid ' + (tab === 'overdue' ? '#c62828' : '#ddd'),
            backgroundColor: tab === 'overdue' ? '#c62828' : '#fff', color: tab === 'overdue' ? '#fff' : '#666',
          }}
        >
          ⚠️ Atrasados ({overdue.length})
        </button>
      </div>

      {list.length === 0 && (
        <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
          {tab === 'upcoming' ? 'Nada agendado pra frente.' : 'Nenhum atrasado 🎉'}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {list.map((m, i) => (
          <MomentRow
            key={`${m.card.id}-${i}`}
            moment={m}
            column={columnById.get(resolveColumnId(m.card, groups) ?? '')}
            onClick={() => handleClick(m)}
          />
        ))}
      </div>
    </div>
  );
}
