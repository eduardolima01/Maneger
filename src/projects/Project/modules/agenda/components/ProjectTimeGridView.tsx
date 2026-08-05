import { useEffect, useRef, useState } from 'react';
import type { Event } from '@/types/event.types';
import {
  snapMinutes, formatHourLabel, formatMinutesLabel, isSameDay,
  fromLocalISO, addDays, formatDuration, minutesSinceMidnight,
} from '@/lib/utils/date';
import ProjectEventBlock from './ProjectEventBlock';
import { useNow } from '@/lib/hooks/useNow';
import { computeOverlapLevels, getVisualRange } from '@/Agenda/utils/eventLayout';

const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PROJECT_EVENT_COLOR = '#1a73e8';

interface ProjectTimeGridViewProps {
  days: Date[];
  events: Event[];
  onCreateEvent: (start: Date, end: Date) => void;
  onEventEdit: (event: Event) => void;
  onEventDoubleClick: (event: Event) => void;
  onEventChange: (id: string, startAt: string, endAt: string) => void;
  onEventDuplicate: (event: Event, startAt: string, endAt: string) => void;
}

export default function ProjectTimeGridView({
  days, events, onCreateEvent,
  onEventEdit, onEventDoubleClick, onEventChange, onEventDuplicate,
}: ProjectTimeGridViewProps) {
  const [draft, setDraft] = useState<{ dayIndex: number; startMin: number; currentMin: number } | null>(null);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const [hoverMinutes, setHoverMinutes] = useState<number | null>(null);

  const CREATE_ZONE_WIDTH = 24;
  function getColumnWidth(): number {
    return columnRefs.current[0]?.getBoundingClientRect().width ?? 0;
  }

  function yToMinutes(dayIndex: number, clientY: number): number {
    const col = columnRefs.current[dayIndex];
    if (!col) return 0;
    const rect = col.getBoundingClientRect();
    const raw = ((clientY - rect.top) / HOUR_HEIGHT) * 60;
    return snapMinutes(Math.max(0, Math.min(24 * 60 - 15, raw)));
  }

  function handlePointerDown(dayIndex: number, e: React.PointerEvent) {
    const startMin = yToMinutes(dayIndex, e.clientY);
    setDraft({ dayIndex, startMin, currentMin: startMin + 30 });

    const handleMove = (ev: PointerEvent) => {
      setDraft((d) => (d ? { ...d, currentMin: Math.max(d.startMin + 15, yToMinutes(dayIndex, ev.clientY)) } : d));
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setDraft((d) => {
        if (d) {
          const day = days[d.dayIndex];
          const start = new Date(day);
          start.setHours(0, d.startMin, 0, 0);
          const end = new Date(day);
          end.setHours(0, d.currentMin, 0, 0);
          onCreateEvent(start, end);
        }
        return null;
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  function handleGridMouseMove(e: React.MouseEvent) {
    const el = gridRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = e.clientY - rect.top + el.scrollTop;
    const raw = (y / HOUR_HEIGHT) * 60;
    setHoverMinutes(snapMinutes(Math.max(0, Math.min(24 * 60 - 1, raw)), 5));
  }

  function handleGridMouseLeave() {
    setHoverMinutes(null);
  }

  const now = useNow();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayIndex = days.findIndex((d) => isSameDay(d, now));

  function getDayTotalMinutes(day: Date): number {
    return events
      .filter((ev) => isSameDay(fromLocalISO(ev.start_at), day))
      .reduce((sum, ev) => {
        const start = fromLocalISO(ev.start_at);
        const end = fromLocalISO(ev.end_at);
        const startMin = minutesSinceMidnight(start);
        const spansMidnight = !isSameDay(start, end);
        const durationMin = spansMidnight ? (24 * 60 - startMin) + minutesSinceMidnight(end) : minutesSinceMidnight(end) - startMin;
        return sum + durationMin;
      }, 0);
  }

  const dayTotals = days.map((day) => getDayTotalMinutes(day));
  const weekTotalMinutes = dayTotals.reduce((sum, m) => sum + m, 0);
  const weekEventCount = events.filter((ev) => days.some((d) => isSameDay(fromLocalISO(ev.start_at), d))).length;

  useEffect(() => {
    const el = gridRef.current;
    if (!el || todayIndex === -1) return;
    const targetScrollTop = (nowMinutes / 60) * HOUR_HEIGHT - el.clientHeight / 2;
    el.scrollTop = Math.max(0, targetScrollTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {days.length > 1 && (
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #e0e0e0', background: '#eef2f7' }}>
          <span style={{ fontSize: 12, color: '#666' }}>
            📊 {weekEventCount} evento{weekEventCount !== 1 ? 's' : ''} nesta semana
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1a73e8' }}>
            Total: {weekTotalMinutes > 0 ? formatDuration(weekTotalMinutes) : '—'}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0' }}>
        <div style={{ width: 56 }} />
        {days.map((day, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderLeft: '1px solid #eee', fontSize: 11, color: '#666' }}>
            {day.toLocaleDateString('pt-BR', { weekday: 'short' })} {day.getDate()}
          </div>
        ))}
      </div>

      <div ref={gridRef} onMouseMove={handleGridMouseMove} onMouseLeave={handleGridMouseLeave} style={{ flex: 1, overflowY: 'auto', display: 'flex', position: 'relative' }}>
        <div style={{ width: 56, position: 'relative' }}>
          {HOURS.map((h) => (
            <div key={h} style={{ height: HOUR_HEIGHT, fontSize: 11, color: '#666', textAlign: 'right', paddingRight: 4, transform: 'translateY(-6px)' }}>
              {formatHourLabel(h)}
            </div>
          ))}
          {hoverMinutes !== null && !draft && (
            <div style={{ position: 'absolute', top: (hoverMinutes / 60) * HOUR_HEIGHT - 6, right: 4, fontSize: 11, fontWeight: 700, color: '#ea4335', backgroundColor: '#fff', pointerEvents: 'none' }}>
              {formatMinutesLabel(hoverMinutes)}
            </div>
          )}
        </div>

        {days.map((day, dayIndex) => (
          <div
            key={dayIndex}
            ref={(el: any) => (columnRefs.current[dayIndex] = el)}
            style={{ flex: 1, position: 'relative', borderLeft: '1px solid #eee', height: HOUR_HEIGHT * 24, backgroundColor: dayIndex === todayIndex ? 'rgba(26,115,232,0.04)' : undefined }}
          >
            {HOURS.map((h) => (
              <div key={h} style={{ position: 'absolute', top: h * HOUR_HEIGHT, left: 0, right: 0, borderTop: '1px solid #f0f0f0', height: HOUR_HEIGHT }} />
            ))}

            <div onPointerDown={(e) => handlePointerDown(dayIndex, e)} style={{ position: 'absolute', inset: 0 }} />
            <div
              onPointerDown={(e) => handlePointerDown(dayIndex, e)}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: CREATE_ZONE_WIDTH, cursor: 'crosshair', zIndex: 50, borderLeft: '1px dashed rgba(26,115,232,0.3)' }}
            />

            {(() => {
              const startSegments = events
                .filter((ev) => isSameDay(fromLocalISO(ev.start_at), day))
                .map((ev) => ({ event: ev, segmentKind: 'start' as const }));

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
                })
              );

              return allSegments.map(({ event: ev, segmentKind }) => (
                <ProjectEventBlock
                  key={`${ev.id}-${segmentKind}`}
                  event={ev}
                  hourHeight={HOUR_HEIGHT}
                  color={PROJECT_EVENT_COLOR}
                  days={days}
                  dayIndex={dayIndex}
                  getColumnWidth={getColumnWidth}
                  segmentKind={segmentKind}
                  overlapLevel={levels[`${ev.id}-${segmentKind}`] ?? 0}
                  onEditClick={onEventEdit}
                  onDoubleClick={onEventDoubleClick}
                  onChange={onEventChange}
                  onDuplicate={onEventDuplicate}
                />
              ));
            })()}

            {dayIndex === todayIndex && (
              <div style={{ position: 'absolute', top: (nowMinutes / 60) * HOUR_HEIGHT, left: 0, right: 0, borderTop: '2px solid #ea4335', zIndex: 3, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', left: -5, top: -4, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ea4335' }} />
              </div>
            )}

            {draft && draft.dayIndex === dayIndex && (
              <div
                style={{
                  position: 'absolute', top: (draft.startMin / 60) * HOUR_HEIGHT,
                  height: ((draft.currentMin - draft.startMin) / 60) * HOUR_HEIGHT,
                  left: 2, right: 2, backgroundColor: 'rgba(26,115,232,0.3)', border: '1px dashed #1a73e8', borderRadius: 4, zIndex: 1,
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', borderTop: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
        <div style={{ width: 56 }} />
        {days.map((_, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderLeft: '1px solid #eee', fontSize: 11, color: '#666' }}>
            {dayTotals[i] > 0 ? formatDuration(dayTotals[i]) : '—'}
          </div>
        ))}
      </div>
    </div>
  );
}
