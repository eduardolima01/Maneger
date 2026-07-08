import { getMonthMatrix, isSameDay, isToday } from '../lib/utils/date';
import type { Event } from '../types/event.types';

interface MonthViewProps {
  anchor: Date;
  events: Event[];
  resolveColor: (projectId: string | null) => string;
  onDayClick: (day: Date) => void;
  onEventClick: (event: Event) => void;
  onCreateEvent: (day: Date) => void;
}

export default function MonthView({
  anchor,
  events,
  resolveColor,
  onDayClick,
  onEventClick,
  onCreateEvent
}: MonthViewProps) {
  const weeks = getMonthMatrix(anchor);

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
                style={{
                  borderLeft: '1px solid #eee',
                  padding: 4,
                  minHeight: 90,
                  cursor: 'pointer',
                  backgroundColor: inMonth ? '#fff' : '#fafafa',
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
                  <div
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    style={{
                      backgroundColor: resolveColor(ev.project_id),
                      color: '#fff',
                      fontSize: 11,
                      borderRadius: 3,
                      padding: '1px 4px',
                      marginBottom: 2,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {ev.title}
                  </div>
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
