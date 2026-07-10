import { useEffect, useRef, useState } from 'react';
import type { Event } from '@/types/event.types';
import { snapMinutes, formatHourLabel, formatMinutesLabel, isSameDay } from '../lib/utils/date';
import EventBlock from './EventBlock';
import { useNow } from '@/lib/hooks/useNow';

const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface TimeGridViewProps {
  days: Date[];
  events: Event[];
  resolveColor: (projectId: string | null) => string;
  resolveCover: (projectId: string | null) => string | null;
  onCreateEvent: (start: Date, end: Date) => void;
  onEventEdit: (event: Event) => void;
  onEventProjectClick: (event: Event) => void;
  onEventDoubleClick: (event: Event) => void;
  onEventChange: (id: string, startAt: string, endAt: string) => void;
  onEventDuplicate: (event: Event, startAt: string, endAt: string) => void;
}

export default function TimeGridView({
  days, events, resolveColor, resolveCover, onCreateEvent,
  onEventEdit, onEventProjectClick, onEventDoubleClick, onEventChange, onEventDuplicate,
}: TimeGridViewProps) {
  const [draft, setDraft] = useState<{ dayIndex: number; startMin: number; currentMin: number } | null>(null);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const [hoverMinutes, setHoverMinutes] = useState<number | null>(null);

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

  useEffect(() => {
    const el = gridRef.current;
    if (!el || todayIndex === -1) return;
    const targetScrollTop = (nowMinutes / 60) * HOUR_HEIGHT - el.clientHeight / 2;
    el.scrollTop = Math.max(0, targetScrollTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]); // só re-centraliza quando o range de dias muda (troca de view/navegação), não a cada minuto

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0' }}>
        <div style={{ width: 56 }} />
        {days.map((day, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '8px 0',
              fontWeight: 600,
              fontSize: 13,
              color: i === todayIndex ? '#1a73e8' : undefined,
            }}
          >
            {day.toLocaleDateString('pt-BR', { weekday: 'short' })} {day.getDate()}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        onMouseMove={handleGridMouseMove}
        onMouseLeave={handleGridMouseLeave}
        style={{ flex: 1, overflowY: 'auto', display: 'flex', position: 'relative' }}
      >
        <div style={{ width: 56, position: 'relative' }}>
          {HOURS.map((h) => (
            <div key={h} style={{ height: HOUR_HEIGHT, fontSize: 11, color: '#666', textAlign: 'right', paddingRight: 4, transform: 'translateY(-6px)' }}>
              {formatHourLabel(h)}
            </div>
          ))}
          {hoverMinutes !== null && !draft && (
            <div
              style={{
                position: 'absolute',
                top: (hoverMinutes / 60) * HOUR_HEIGHT - 6,
                right: 4,
                fontSize: 11,
                fontWeight: 700,
                color: '#ea4335',
                backgroundColor: '#fff',
                pointerEvents: 'none',
              }}
            >
              {formatMinutesLabel(hoverMinutes)}
            </div>
          )}
        </div>

        {days.map((day, dayIndex) => (
          <div
            key={dayIndex}
            ref={(el: any) => (columnRefs.current[dayIndex] = el)}
            onPointerDown={(e) => handlePointerDown(dayIndex, e)}
            style={{
              flex: 1,
              position: 'relative',
              borderLeft: '1px solid #eee',
              height: HOUR_HEIGHT * 24,
              backgroundColor: dayIndex === todayIndex ? 'rgba(26,115,232,0.04)' : undefined,
            }}
          >
            {HOURS.map((h) => (
              <div key={h} style={{ position: 'absolute', top: h * HOUR_HEIGHT, left: 0, right: 0, borderTop: '1px solid #f0f0f0', height: HOUR_HEIGHT }} />
            ))}

            {events
              .filter((ev) => isSameDay(new Date(ev.start_at), day))
              .map((ev) => (
                <EventBlock
                  key={ev.id}
                  event={ev}
                  hourHeight={HOUR_HEIGHT}
                  color={resolveColor(ev.project_id)}
                  coverPath={resolveCover(ev.project_id)}
                  days={days}
                  dayIndex={dayIndex}
                  getColumnWidth={getColumnWidth}
                  onEditClick={onEventEdit}
                  onProjectClick={onEventProjectClick}
                  onDoubleClick={onEventDoubleClick}
                  onChange={onEventChange}
                  onDuplicate={onEventDuplicate}
                />
              ))}

            {dayIndex === todayIndex && (
              <div
                style={{
                  position: 'absolute',
                  top: (nowMinutes / 60) * HOUR_HEIGHT,
                  left: 0,
                  right: 0,
                  borderTop: '2px solid #ea4335',
                  zIndex: 3,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: -5,
                    top: -4,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#ea4335',
                  }}
                />
              </div>
            )}

            {draft && draft.dayIndex === dayIndex && (
              <div
                style={{
                  position: 'absolute',
                  top: (draft.startMin / 60) * HOUR_HEIGHT,
                  height: ((draft.currentMin - draft.startMin) / 60) * HOUR_HEIGHT,
                  left: 2,
                  right: 2,
                  backgroundColor: 'rgba(26,115,232,0.3)',
                  border: '1px dashed #1a73e8',
                  borderRadius: 4,
                  zIndex: 1,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
