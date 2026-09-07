import { useEffect, useRef, useState } from 'react';
import { getEventsByRange } from '@/lib/api/events';
import { addDays, toLocalISO } from '@/lib/utils/date';
import type { Event } from '@/types/event.types';

/**
 * Busca eventos de semanas passadas (offsets negativos, em nº de semanas
 * relativas a `weekStart`) sob demanda, com cache em memória por
 * (weekStart, offset) enquanto o hook ficar montado.
 *
 * offset 0 (semana atual) NUNCA é buscado aqui — quem usa este hook já tem
 * esses eventos carregados via useEvents() e deve tratá-los separadamente.
 */
export function useWeekComparisonEvents(weekStart: Date, offsets: number[]) {
  const [dataByOffset, setDataByOffset] = useState<Record<number, Event[]>>({});
  const fetchedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const weekStartTime = weekStart.getTime();
    const toFetch = offsets.filter(
      (o) => o !== 0 && !fetchedKeysRef.current.has(`${weekStartTime}:${o}`)
    );
    if (toFetch.length === 0) return;

    let cancelled = false;
    toFetch.forEach((o) => fetchedKeysRef.current.add(`${weekStartTime}:${o}`));

    Promise.all(
      toFetch.map(async (offset) => {
        const start = addDays(weekStart, offset * 7);
        const end = addDays(start, 7);
        const events = await getEventsByRange(toLocalISO(start), toLocalISO(end));
        return [offset, events] as const;
      })
    ).then((results) => {
      if (cancelled) return;
      setDataByOffset((prev) => {
        const next = { ...prev };
        for (const [offset, events] of results) next[offset] = events;
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime(), offsets.join(',')]);

  return { dataByOffset };
}
