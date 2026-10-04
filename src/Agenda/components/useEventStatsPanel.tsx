import { useEffect, useState } from 'react';
import { getEventsByRange } from '@/lib/api/events';
import { addDays, startOfWeek, toLocalISO, fromLocalISO } from '@/lib/utils/date';
import type { Event } from '@/types/event.types';

const PREVIOUS_WEEKS = 4;

export interface EventStatsData {
  /** Total (minutos) do projeto na semana que contém o evento clicado. */
  weekMinutes: number;
  /** Total (minutos) do projeto no mês que contém o evento clicado. */
  monthMinutes: number;
  /**
   * Média diária (minutos) do projeto no mês do evento.
   * Suposição não confirmada com o usuário: se o mês do evento é o mês
   * corrente, divide pelos dias já passados até hoje; se é um mês
   * passado ou futuro, divide pelo total de dias do mês.
   */
  dailyAverageMinutes: number;
  /** Rótulo do mês exibido, ex: "setembro de 2026". */
  monthLabel: string;
  /** Semanas anteriores à do evento, offset -1 a -4, mais recente primeiro. */
  previousWeeks: { offset: number; minutes: number }[];
}

function eventMinutes(ev: Event): number {
  const start = fromLocalISO(ev.start_at).getTime();
  const end = fromLocalISO(ev.end_at).getTime();
  return Math.max(0, Math.round((end - start) / 60000));
}

function sumForProject(events: Event[], projectId: string): number {
  return events
    .filter((ev) => ev.project_id === projectId)
    .reduce((sum, ev) => sum + eventMinutes(ev), 0);
}

/**
 * Busca, sob demanda, os totais de tempo do projeto de `event` na semana e
 * no mês que contêm esse evento, mais as PREVIOUS_WEEKS semanas anteriores
 * à semana do evento (não à semana corrente do calendário) — pra que
 * comparar um evento antigo mostre o contexto de quando ele aconteceu, não
 * o de hoje.
 *
 * Reaproveita getEventsByRange, no mesmo espírito de useWeekComparisonEvents,
 * já que a Agenda pode ter só o range da view atual carregado em memória.
 */
export function useEventStatsPanel(event: Event | null) {
  const [data, setData] = useState<EventStatsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!event || !event.project_id) {
      setData(null);
      setLoading(false);
      return;
    }

    const projectId = event.project_id;
    const eventDate = fromLocalISO(event.start_at);
    const weekStart = startOfWeek(eventDate);
    const monthStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), 1);
    const monthEnd = new Date(eventDate.getFullYear(), eventDate.getMonth() + 1, 1);

    let cancelled = false;
    setLoading(true);

    const weekPromise = getEventsByRange(toLocalISO(weekStart), toLocalISO(addDays(weekStart, 7)));
    const monthPromise = getEventsByRange(toLocalISO(monthStart), toLocalISO(monthEnd));
    const prevWeekPromises = Array.from({ length: PREVIOUS_WEEKS }, (_, i) => {
      const offset = -(i + 1);
      const start = addDays(weekStart, offset * 7);
      return getEventsByRange(toLocalISO(start), toLocalISO(addDays(start, 7))).then((evs) => ({
        offset,
        minutes: sumForProject(evs, projectId),
      }));
    });

    Promise.all([weekPromise, monthPromise, ...prevWeekPromises]).then(([weekEvents, monthEvents, ...previousWeeks]) => {
      if (cancelled) return;

      const weekMinutes = sumForProject(weekEvents, projectId);
      const monthMinutes = sumForProject(monthEvents, projectId);

      const now = new Date();
      const isCurrentMonth = eventDate.getFullYear() === now.getFullYear() && eventDate.getMonth() === now.getMonth();
      const daysInMonth = new Date(eventDate.getFullYear(), eventDate.getMonth() + 1, 0).getDate();
      const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth;
      const dailyAverageMinutes = daysElapsed > 0 ? monthMinutes / daysElapsed : 0;

      setData({
        weekMinutes,
        monthMinutes,
        dailyAverageMinutes,
        monthLabel: monthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        previousWeeks,
      });
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, event?.project_id, event?.start_at]);

  return { data, loading };
}
