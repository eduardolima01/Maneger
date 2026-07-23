import { useState } from 'react';
import {
  getMonthMatrix,
  isSameDay,
  fromLocalISO,
  toLocalISO,
  isToday,
} from '@/lib/utils/date';

import type { Event } from '../types/event.types';
import { MonthEventChip } from './MonthEventChip';
import { ProjectType } from '@/types/project.types';

interface MonthViewProps {
  anchor: Date;
  events: Event[];
  resolveColor: (projectId: string | null) => string;
  resolveCover: (projectId: string | null) => string | null;
  resolveBreadcrumb: (projectId: string | null) => ProjectType[];
  onEventDoubleClick: (event: Event) => void;
  onDayClick: (day: Date) => void;
  onEventEdit: (event: Event) => void;
  onEventProjectClick: (event: Event) => void;
  onCreateEvent: (day: Date) => void;
  onEventChange: (id: string, startAt: string, endAt: string) => void;
  onEventDuplicate: (event: Event, startAt: string, endAt: string) => void;
  onProjectAssign: (eventId: string, projectId: string | null) => void;
}

function moveEventToDay(event: Event, targetDay: Date) {
  const start = fromLocalISO(event.start_at);
  const end = fromLocalISO(event.end_at);
  const durationMs = end.getTime() - start.getTime();

  const newStart = new Date(targetDay);
  newStart.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
  const newEnd = new Date(newStart.getTime() + durationMs);

  return { startAt: toLocalISO(newStart), endAt: toLocalISO(newEnd) };
}

export default function MonthView({
  anchor,
  events,
  resolveColor,
  resolveCover,
  resolveBreadcrumb,
  onEventDoubleClick,
  onDayClick,
  onEventEdit,
  onCreateEvent,
  onEventProjectClick,
  onEventChange,
  onEventDuplicate,
  onProjectAssign
}: MonthViewProps) {
  const weeks = getMonthMatrix(anchor);
  const [hoveredDayKey, setHoveredDayKey] = useState<string | null>(null);

  return (
    <div style={{ display: 'grid', gridTemplateRows: `auto repeat(${weeks.length}, 1fr)`, height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e0e0e0' }}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
          <div key={d} style={{ textAlign: 'center', padding: 8, fontWeight: 600, fontSize: 13 }}>{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #eee' }}>
          {week.map((day, di) => {
            const dayEvents = events.filter((ev) => isSameDay(new Date(ev.start_at), day));
            const inMonth = day.getMonth() === anchor.getMonth();

            return (
              <div
                key={di}
                onClick={() => onCreateEvent(day)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move';
                  setHoveredDayKey(day.toDateString());
                }}
                onDragLeave={() => setHoveredDayKey((k) => (k === day.toDateString() ? null : k))}
                onDrop={(e) => {
                  e.preventDefault();
                  setHoveredDayKey(null);
                  const eventId = e.dataTransfer.getData('text/plain');
                  const draggedEvent = events.find((ev) => ev.id === eventId);
                  if (!draggedEvent) return;

                  const { startAt, endAt } = moveEventToDay(draggedEvent, day);
                  if (e.altKey) {
                    onEventDuplicate(draggedEvent, startAt, endAt);
                  } else {
                    onEventChange(draggedEvent.id, startAt, endAt);
                  }
                }}
                style={{
                  borderLeft: '1px solid #eee',
                  padding: 4,
                  minHeight: 90,
                  cursor: 'pointer',
                  backgroundColor: hoveredDayKey === day.toDateString()
                    ? '#e8f0fe'
                    : inMonth ? '#fff' : '#fafafa',
                  color: inMonth ? '#000' : '#aaa',
                }}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onDayClick(day);
                  }}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    backgroundColor: isToday(day) ? '#1a73e8' : 'transparent',
                    color: isToday(day) ? '#fff' : inMonth ? '#000' : '#aaa',
                  }}
                >
                  {day.getDate()}
                </div>
                {dayEvents.slice(0, 3).map((ev) => (
                  <MonthEventChip
                    key={ev.id}
                    event={ev}
                    color={resolveColor(ev.project_id)}
                    coverPath={resolveCover(ev.project_id)}
                    breadcrumb={resolveBreadcrumb(ev.project_id)}
                    onEdit={onEventEdit}
                    onProjectClick={onEventProjectClick}
                    onDoubleClick={onEventDoubleClick}
                    onProjectAssign={onProjectAssign}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <div style={{ fontSize: 11, color: '#666' }}>+{dayEvents.length - 3} mais</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
