import { fromLocalISO, isSameDay, minutesSinceMidnight } from '@/lib/utils/date';
import type { Event } from '@/types/event.types';

export interface VisualRange {
  startMin: number;
  endMin: number;
}

/** Intervalo visual (em minutos desde meia-noite) que um segmento do evento ocupa NESSA coluna de dia específica. */
export function getVisualRange(event: Event, segmentKind: 'start' | 'continuation'): VisualRange {
  const start = fromLocalISO(event.start_at);
  const end = fromLocalISO(event.end_at);
  const spansMidnight = !isSameDay(start, end);
  const startMin = minutesSinceMidnight(start);
  const endMinRaw = minutesSinceMidnight(end);

  if (segmentKind === 'continuation') {
    return { startMin: 0, endMin: Math.max(15, endMinRaw) };
  }
  if (spansMidnight) {
    return { startMin, endMin: 24 * 60 };
  }
  return { startMin, endMin: Math.max(startMin + 15, endMinRaw) };
}

export function computeOverlapLevels(
  items: { key: string; startMin: number; endMin: number }[]
): Record<string, number> {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const levels: Record<string, number> = {};
  const active: { key: string; endMin: number }[] = [];

  for (const item of sorted) {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endMin <= item.startMin) active.splice(i, 1);
    }
    levels[item.key] = active.length;
    active.push({ key: item.key, endMin: item.endMin });
  }

  return levels;
}
