import type { KanbanCard } from '@/types/kanban.types';

/** Situação de HOJE num plano acompanhado no próprio card. */
export type TodayState = 'active' | 'notasks' | 'off' | 'before' | 'after' | 'nodates';
export type TodayColor = 'green' | 'yellow' | 'gray';

export interface TodayInfo {
  state: TodayState;
  date: string;
  done: number;
  total: number;
  color: TodayColor;
  /** Título que você deu ao quadrado de hoje ('' = sem título). */
  title: string;
  /** Quando o plano ainda não começou: data de início ('YYYY-MM-DD'). */
  startsOn?: string;
}

const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtLongDate(k: string): string {
  const [y, m, d] = k.slice(0, 10).split('-').map(Number);
  return `${WEEK_LABELS[new Date(y, m - 1, d).getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function fmtShortDate(k: string): string {
  return `${k.slice(8, 10)}/${k.slice(5, 7)}`;
}

export const TODAY_COLORS: Record<TodayColor, string | null> = { green: '#2ea043', yellow: '#f4a623', gray: null };
export const TODAY_LABEL: Record<TodayColor, string> = { green: 'Todas as tarefas feitas', yellow: 'Algumas tarefas feitas', gray: 'Nenhuma tarefa feita ainda' };

export function todayInfo(card: KanbanCard, taskIds: Set<string>): TodayInfo {
  const date = todayKey();
  const base = { date, done: 0, total: taskIds.size, color: 'gray' as TodayColor, title: card.planDayTitles?.[date] ?? '' };
  const start = card.startDate?.slice(0, 10);
  const end = card.dueDate?.slice(0, 10);
  if (!start || !end || start > end) return { ...base, state: 'nodates' };
  if (date < start) return { ...base, state: 'before', startsOn: start };
  if (date > end) return { ...base, state: 'after' };
  const weekdays = card.planWeekdays.length > 0 ? card.planWeekdays : [0, 1, 2, 3, 4, 5, 6];
  const [y, m, d] = date.split('-').map(Number);
  if (!weekdays.includes(new Date(y, m - 1, d).getDay())) return { ...base, state: 'off' };
  const done = (card.planDayChecks?.[date] ?? []).filter((id) => taskIds.has(id)).length;
  const color: TodayColor = taskIds.size > 0 && done >= taskIds.size ? 'green' : done > 0 ? 'yellow' : 'gray';
  return { ...base, state: taskIds.size === 0 ? 'notasks' : 'active', done, color };
}
