import { useEffect, useState } from 'react';
import { getEventsByRange } from '@/lib/api/events';
import { addDays, startOfDay, toLocalISO, fromLocalISO, minutesSinceMidnight, isSameDay } from '@/lib/utils/date';
import type { Event } from '@/types/event.types';

const LOOKBACK_DAYS = 7;
const MIN_OCCURRENCES = 4; // maioria dos últimos 7 dias

export interface GhostSuggestion {
  title: string;
  projectId: string | null;
  startMin: number;
  endMin: number;
}

/**
 * Detecta um evento (mesmo título + mesmo projeto + mesmo horário) que
 * apareceu em pelo menos MIN_OCCURRENCES dos últimos LOOKBACK_DAYS dias —
 * não precisa ser em sequência, só precisa ter acontecido na maioria dos
 * dias da última semana — e sugere criá-lo hoje, desde que hoje ainda não
 * tenha nada no mesmo horário.
 *
 * Só olha pra frente (sugestão pra hoje), nunca sugere em outros dias da
 * grade — decisão explícita do usuário. Eventos que cruzam meia-noite são
 * ignorados na detecção do padrão, pra manter a comparação de horário simples.
 */
export function useGhostEventSuggestion(todayEvents: Event[], today: Date, isTodayVisible: boolean) {
  const [suggestion, setSuggestion] = useState<GhostSuggestion | null>(null);
  const todayEventIds = todayEvents.map((e) => e.id).join(',');

  useEffect(() => {
    if (!isTodayVisible) {
      setSuggestion(null);
      return;
    }

    let cancelled = false;
    const todayStart = startOfDay(today);
    const rangeStart = addDays(todayStart, -LOOKBACK_DAYS);

    getEventsByRange(toLocalISO(rangeStart), toLocalISO(todayStart))
      .then((pastEvents) => {
        if (cancelled) return;

        // Pra cada assinatura (título+projeto+horário), guarda em quantos
        // dias distintos dos últimos LOOKBACK_DAYS ela apareceu.
        const daysWithSig = new Map<string, Set<string>>();
        const sigData = new Map<string, GhostSuggestion>();

        for (const ev of pastEvents) {
          const start = fromLocalISO(ev.start_at);
          const end = fromLocalISO(ev.end_at);
          if (!isSameDay(start, end)) continue; // ignora eventos que cruzam meia-noite

          const dayKey = startOfDay(start).toDateString();
          const startMin = minutesSinceMidnight(start);
          const endMin = minutesSinceMidnight(end);
          const sig = `${ev.title}::${ev.project_id ?? ''}::${startMin}::${endMin}`;

          if (!daysWithSig.has(sig)) daysWithSig.set(sig, new Set());
          daysWithSig.get(sig)!.add(dayKey);
          sigData.set(sig, { title: ev.title, projectId: ev.project_id, startMin, endMin });
        }

        let best: { sig: string; count: number } | null = null;
        for (const [sig, days] of daysWithSig) {
          if (days.size >= MIN_OCCURRENCES && (!best || days.size > best.count)) {
            best = { sig, count: days.size };
          }
        }

        if (!best) {
          // eslint-disable-next-line no-console
          console.debug(
            `[useGhostEventSuggestion] nenhuma sugestão. Assinaturas encontradas nos últimos ${LOOKBACK_DAYS} dias (precisa de ${MIN_OCCURRENCES}+):`,
            Array.from(daysWithSig.entries()).map(([sig, days]) => `${sig} → ${days.size}x`)
          );
          setSuggestion(null);
          return;
        }

        const found = sigData.get(best.sig)!;
        const alreadyHasToday = todayEvents.some(
          (ev) => minutesSinceMidnight(fromLocalISO(ev.start_at)) === found.startMin
        );

        setSuggestion(alreadyHasToday ? null : found);
      })
      .catch((err) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('useGhostEventSuggestion: falha ao buscar eventos anteriores', err);
        setSuggestion(null);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTodayVisible, today.toDateString(), todayEventIds]);

  return suggestion;
}
