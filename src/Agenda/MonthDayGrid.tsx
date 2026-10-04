import { useEffect, useRef } from 'react';
import type { Event } from '@/types/event.types';
import type { ProjectType } from '@/types/project.types';
import { addDays, fromLocalISO, formatHourLabel, isSameDay } from '../lib/utils/date';
import EventBlock from './EventBlock';
import { useNow } from '@/lib/hooks/useNow';
import { computeOverlapLevels, getVisualRange } from './utils/eventLayout';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const GUTTER = 30;

interface MonthDayGridProps {
  day: Date;
  /** Dias da semana desta linha e posição do dia nela: permite mover/copiar o evento para outro dia da semana arrastando na horizontal. */
  week: Date[];
  dayIndex: number;
  events: Event[];
  hourHeight: number;
  /** Minuto do dia que fica no topo da área visível (compartilhado entre os dias da semana). */
  scrollMin: number;
  registerScroller: (el: HTMLDivElement) => void;
  unregisterScroller: (el: HTMLDivElement) => void;
  onScrolled: (el: HTMLDivElement, hourHeight: number) => void;
  resolveColor: (projectId: string | null) => string;
  resolveCover: (projectId: string | null) => string | null;
  resolveEventImages: (event: Event) => string[];
  resolveBreadcrumb: (projectId: string | null) => ProjectType[];
  onEventEdit: (event: Event) => void;
  onEventProjectClick: (event: Event) => void;
  onEventDoubleClick: (event: Event) => void;
  onEventClick: (event: Event) => void;
  onEventChange: (id: string, startAt: string, endAt: string) => void;
  onEventDuplicate: (event: Event, startAt: string, endAt: string) => void;
  onProjectAssign: (eventId: string, projectId: string | null) => void;
  onEventRequestDelete: (event: Event) => void;
  onOpenInfoPopup: (event: Event, cover?: string | null) => void;
  onOpenHistory?: (event: Event) => void;
}

/**
 * Mini grade de horas (00h–23h) de um dia da visão do mês — mesmos blocos
 * (EventBlock), sobreposição e continuação de eventos que cruzam a meia-noite
 * da visão de semana/dia, então mover, redimensionar e editar funcionam igual.
 */
export default function MonthDayGrid({
  day, week, dayIndex, events, hourHeight, scrollMin, registerScroller, unregisterScroller, onScrolled,
  resolveColor, resolveCover, resolveEventImages, resolveBreadcrumb,
  onEventEdit, onEventProjectClick, onEventDoubleClick, onEventClick,
  onEventChange, onEventDuplicate, onProjectAssign, onEventRequestDelete, onOpenInfoPopup, onOpenHistory,
}: MonthDayGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const now = useNow();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isTodayCell = isSameDay(day, now);

  // posiciona no minuto compartilhado ao montar e quando a escala muda (linha redimensionada)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = (scrollMin / 60) * hourHeight;
    registerScroller(el);
    return () => unregisterScroller(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourHeight]);

  const startSegments = events
    .filter((ev) => isSameDay(fromLocalISO(ev.start_at), day))
    .map((ev) => ({ event: ev, segmentKind: 'start' as const }));

  // evento que começou no dia anterior e atravessou a meia-noite: aparece aqui de 00h até o fim
  const continuationSegments = events
    .filter((ev) => {
      const start = fromLocalISO(ev.start_at);
      const end = fromLocalISO(ev.end_at);
      if (isSameDay(start, end)) return false;
      return isSameDay(start, addDays(day, -1));
    })
    .map((ev) => ({ event: ev, segmentKind: 'continuation' as const }));

  const allSegments = [...startSegments, ...continuationSegments];
  const levels = computeOverlapLevels(
    allSegments.map(({ event, segmentKind }) => {
      const range = getVisualRange(event, segmentKind);
      return { key: `${event.id}-${segmentKind}`, startMin: range.startMin, endMin: range.endMin };
    }),
  );

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => onScrolled(e.currentTarget, hourHeight)}
      onClick={(e) => e.stopPropagation()}
      className="[scrollbar-width:thin]"
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}
    >
      <div style={{ position: 'relative', display: 'flex', height: hourHeight * 24 }}>
        <div style={{ width: GUTTER, flexShrink: 0, position: 'relative' }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="text-gray-500 dark:text-gray-400"
              style={{ position: 'absolute', top: Math.max(0, h * hourHeight - 6), right: 3, fontSize: 9, lineHeight: '12px', userSelect: 'none' }}
            >
              {formatHourLabel(h)}
            </div>
          ))}
        </div>

        <div ref={gridRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="border-t border-gray-100 dark:border-gray-800"
              style={{ position: 'absolute', top: h * hourHeight, left: 0, right: 0, height: hourHeight }}
            />
          ))}

          {allSegments.map(({ event: ev, segmentKind }) => (
            <EventBlock
              key={`${ev.id}-${segmentKind}`}
              event={ev}
              hourHeight={hourHeight}
              color={resolveColor(ev.project_id)}
              images={resolveEventImages(ev)}
              fallbackCover={resolveCover(ev.project_id)}
              breadcrumb={resolveBreadcrumb(ev.project_id)}
              days={week}
              dayIndex={dayIndex}
              // largura da célula do dia = distância entre colunas (a mesma conta da visão de semana)
              getColumnWidth={() => scrollRef.current?.parentElement?.offsetWidth ?? 120}
              segmentKind={segmentKind}
              overlapLevel={levels[`${ev.id}-${segmentKind}`] ?? 0}
              onEditClick={onEventEdit}
              onProjectClick={onEventProjectClick}
              onDoubleClick={onEventDoubleClick}
              onEventClick={onEventClick}
              onChange={onEventChange}
              onDuplicate={onEventDuplicate}
              onProjectAssign={onProjectAssign}
              onRequestDelete={onEventRequestDelete}
              onOpenInfoPopup={onOpenInfoPopup}
              onOpenHistory={onOpenHistory}
            />
          ))}

          {isTodayCell && (
            <div
              style={{
                position: 'absolute',
                top: (nowMinutes / 60) * hourHeight,
                left: 0,
                right: 0,
                borderTop: '2px solid #ea4335',
                zIndex: 5,
                pointerEvents: 'none',
              }}
            >
              <div style={{ position: 'absolute', left: -4, top: -5, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ea4335' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
