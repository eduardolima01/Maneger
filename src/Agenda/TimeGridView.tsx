import { useEffect, useRef, useState } from 'react';
import type { Event } from '@/types/event.types';
import { snapMinutes, formatHourLabel, formatMinutesLabel, isSameDay, fromLocalISO, addDays, formatDuration, minutesSinceMidnight } from '../lib/utils/date';
import EventBlock from './EventBlock';
import { useNow } from '@/lib/hooks/useNow';
import { ProjectType } from '@/types/project.types';
import { convertFileSrc } from '@tauri-apps/api/core';
import WeekSummaryModal from './WeekSummaryModal';
import { computeOverlapLevels, getVisualRange } from './utils/eventLayout';

const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface TimeGridViewProps {
  days: Date[];
  events: Event[];
  resolveColor: (projectId: string | null) => string;
  resolveCover: (projectId: string | null) => string | null;
  resolveBreadcrumb: (projectId: string | null) => ProjectType[];
  onCreateEvent: (start: Date, end: Date) => void;
  onEventEdit: (event: Event) => void;
  onEventProjectClick: (event: Event) => void;
  onEventDoubleClick: (event: Event) => void;
  onEventChange: (id: string, startAt: string, endAt: string) => void;
  onEventDuplicate: (event: Event, startAt: string, endAt: string) => void;
  onProjectAssign: (eventId: string, projectId: string | null) => void;
  onProjectSummaryClick: (projectId: string | null) => void;
}

export default function TimeGridView({
  days, events, resolveColor, resolveCover, onCreateEvent, resolveBreadcrumb,
  onEventEdit, onEventProjectClick, onEventDoubleClick, onEventChange, onEventDuplicate,
  onProjectAssign, onProjectSummaryClick
}: TimeGridViewProps) {
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

  function getDaySummary(day: Date): { totalMinutes: number; count: number; byProject: Record<string, { projectId: string | null; label: string; minutes: number }> } | null {
    const dayEvents = events.filter((ev) => isSameDay(fromLocalISO(ev.start_at), day));
    if (dayEvents.length === 0) return null;

    let totalMinutes = 0;
    const byProject: Record<string, { projectId: string | null; label: string; minutes: number }> = {};

    for (const ev of dayEvents) {
      const start = fromLocalISO(ev.start_at);
      const end = fromLocalISO(ev.end_at);
      const startMin = minutesSinceMidnight(start);
      const spansMidnight = !isSameDay(start, end);
      const durationMin = spansMidnight ? (24 * 60 - startMin) + minutesSinceMidnight(end) : minutesSinceMidnight(end) - startMin;

      totalMinutes += durationMin;

      const key = ev.project_id ?? '__none__';
      const breadcrumb = resolveBreadcrumb(ev.project_id);
      const label = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].name : 'Sem projeto';
      if (!byProject[key]) byProject[key] = { projectId: ev.project_id, label, minutes: 0 };
      byProject[key].minutes += durationMin;
    }

    return { totalMinutes, count: dayEvents.length, byProject };
  }


  const daySummaries = days.map((day) => getDaySummary(day));
  const weekTotalMinutes = daySummaries.reduce((sum, s) => sum + (s?.totalMinutes ?? 0), 0);
  const weekEventCount = daySummaries.reduce((sum, s) => sum + (s?.count ?? 0), 0);

  const weekByProject: Record<string, { projectId: string | null; label: string; minutes: number }> = {};
  for (const summary of daySummaries) {

    if (!summary) continue;
    for (const [key, entry] of Object.entries(summary.byProject)) {
      if (!weekByProject[key]) weekByProject[key] = { projectId: entry.projectId, label: entry.label, minutes: 0 };
      weekByProject[key].minutes += entry.minutes;
    }
  }

  const weekByProjectSorted = Object.values(weekByProject).sort((a, b) => b.minutes - a.minutes);

  const [weekSummaryOpen, setWeekSummaryOpen] = useState(false);

  useEffect(() => {
    const el = gridRef.current;
    if (!el || todayIndex === -1) return;
    const targetScrollTop = (nowMinutes / 60) * HOUR_HEIGHT - el.clientHeight / 2;
    el.scrollTop = Math.max(0, targetScrollTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]); // só re-centraliza quando o range de dias muda (troca de view/navegação), não a cada minuto

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {days.length > 1 && (
        <button
          onClick={() => setWeekSummaryOpen(true)}
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 12px', border: 'none', borderBottom: '1px solid #e0e0e0', background: '#eef2f7', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 12, color: '#666' }}>
            📊 {weekEventCount} evento{weekEventCount !== 1 ? 's' : ''} nesta semana
          </span>
          <span title="semana contem 168 horas" style={{ fontSize: 14, fontWeight: 700, color: '#1a73e8' }}>
            Total: {weekTotalMinutes > 0 ? formatDuration(weekTotalMinutes) : '—'}
          </span>
        </button>
      )}


      <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0' }}>
        <div style={{ width: 56 }} />
        {days.map((day, i) => (
          <div
            key={i}
            style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderLeft: '1px solid #eee', fontSize: 11, color: '#666' }}
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

            <div
              onPointerDown={(e) => handlePointerDown(dayIndex, e)}
              style={{ position: 'absolute', inset: 0 }}
            />

            <div
              onPointerDown={(e) => handlePointerDown(dayIndex, e)}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: CREATE_ZONE_WIDTH,
                cursor: 'crosshair',
                zIndex: 50,
                // backgroundColor: 'rgba(26,115,232,0.06)',
                // backgroundColor: "#fff",
                borderLeft: '1px dashed rgba(26,115,232,0.3)',
              }}
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
                <EventBlock
                  key={`${ev.id}-${segmentKind}`}
                  event={ev}
                  hourHeight={HOUR_HEIGHT}
                  color={resolveColor(ev.project_id)}
                  coverPath={resolveCover(ev.project_id)}
                  breadcrumb={resolveBreadcrumb(ev.project_id)}
                  days={days}
                  dayIndex={dayIndex}
                  getColumnWidth={getColumnWidth}
                  segmentKind={segmentKind}
                  overlapLevel={levels[`${ev.id}-${segmentKind}`] ?? 0}
                  onEditClick={onEventEdit}
                  onProjectClick={onEventProjectClick}
                  onDoubleClick={onEventDoubleClick}
                  onChange={onEventChange}
                  onDuplicate={onEventDuplicate}
                  onProjectAssign={onProjectAssign}
                />
              ));
            })()}
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

      <div style={{ display: 'flex', borderTop: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
        <div style={{ width: 56 }} />
        {days.map((_, i) => {
          const summary = daySummaries[i];

          const projectsSorted = summary ? Object.values(summary.byProject).sort((a, b) => b.minutes - a.minutes) : [];
          return (
            <div
              key={i}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '6px 4px',
                borderLeft: '1px solid #eee',
                fontSize: 11,
                color: '#fff',
                maxHeight: 100,
                overflowY: 'auto',
              }}
            >
              {summary ? (
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', paddingLeft: 4 }}>
                  {projectsSorted.map((p) => {
                    const cover = resolveCover(p.projectId);
                    const color = resolveColor(p.projectId);
                    return (
                      <div
                        key={p.projectId ?? '__none__'}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, backgroundColor: color, borderRadius: 4, padding: '2px 4px', cursor: 'pointer' }}
                        className="border hover:border-black"
                        onClick={() => onProjectSummaryClick(p.projectId)}
                      >
                        {cover ? (
                          <img src={convertFileSrc(cover)} className="w-3 h-3 rounded-full object-cover shrink-0" />
                        ) : (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color, flexShrink: 0, border: '1px solid #fff' }} />
                        )}
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
                        <span style={{ flexShrink: 0, fontWeight: 600 }}>{formatDuration(p.minutes)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span style={{ color: '#ccc' }}>—</span>
              )}
            </div>
          );
        })}
        <WeekSummaryModal
          isOpen={weekSummaryOpen}
          onClose={() => setWeekSummaryOpen(false)}
          eventCount={weekEventCount}
          totalMinutes={weekTotalMinutes}
          byProject={weekByProjectSorted}
          resolveCover={resolveCover}
          resolveColor={resolveColor}
        />
      </div>
    </div>
  );
}
