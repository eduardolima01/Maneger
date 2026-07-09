import { getMonthMatrix, isSameDay, isToday } from '../lib/utils/date';
import type { Event } from '../types/event.types';

interface MonthViewProps {
  anchor: Date;
  events: Event[];
  resolveColor: (projectId: string | null) => string;
  onDayClick: (day: Date) => void;
  onEventEdit: (event: Event) => void;
  onEventProjectClick: (event: Event) => void;
  onCreateEvent: (day: Date) => void;
}

export default function MonthView({
  anchor,
  events,
  resolveColor,
  onDayClick,
  onEventEdit,
  onCreateEvent,
  onEventProjectClick
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
                    className="group relative flex items-center justify-between"
                    style={{ backgroundColor: resolveColor(ev.project_id), color: '#fff', fontSize: 11, borderRadius: 3, padding: '1px 4px', marginBottom: 2 }}
                  >
                    {ev.title}
                    <span className="truncate">{ev.title}</span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventEdit(ev);
                        }}
                        title="Editar evento"
                        className="w-3 h-3 flex items-center justify-center rounded bg-black/25 hover:bg-black/40"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2 h-2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                      {ev.project_id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventProjectClick(ev);
                          }}
                          title="Ir para o projeto"
                          className="w-3 h-3 flex items-center justify-center rounded bg-black/25 hover:bg-black/40"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2 h-2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <path d="M15 3h6v6" />
                            <path d="M10 14 21 3" />
                          </svg>
                        </button>
                      )}
                    </div>
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
