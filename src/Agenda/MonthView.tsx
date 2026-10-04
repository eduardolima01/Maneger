import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  getMonthMatrix,
  isSameDay,
  fromLocalISO,
  toLocalISO,
  isToday,
  minutesSinceMidnight,
} from '@/lib/utils/date';

import type { Event } from '../types/event.types';
import { MonthEventChip } from './MonthEventChip';
import MonthDayGrid from './MonthDayGrid';
import { usePersistentState } from './hooks/usePersistentState';
import EventInfoPopup from './components/EventInfoPopup';
import { ProjectType } from '@/types/project.types';
import { PROJECT_DRAG_ID_KEY, PROJECT_DRAG_NAME_KEY } from './components/AgendaProjectSidebar';

interface MonthViewProps {
  anchor: Date;
  events: Event[];
  resolveColor: (projectId: string | null) => string;
  resolveCover: (projectId: string | null) => string | null;
  resolveEventImages: (event: Event) => string[];
  resolveBreadcrumb: (projectId: string | null) => ProjectType[];
  onEventDoubleClick: (event: Event) => void;
  onEventClick: (event: Event) => void;
  onDayClick: (day: Date) => void;
  onEventEdit: (event: Event) => void;
  onEventProjectClick: (event: Event) => void;
  onCreateEvent: (day: Date) => void;
  onEventChange: (id: string, startAt: string, endAt: string) => void;
  onEventDuplicate: (event: Event, startAt: string, endAt: string) => void;
  onProjectAssign: (eventId: string, projectId: string | null) => void;
  onEventRequestDelete: (event: Event) => void;
  onEventHistory?: (event: Event) => void;
  onProjectDrop: (projectId: string, projectName: string, start: Date, end: Date) => void;
}

function isHeightMap(v: unknown): v is Record<string, number> {
  return !!v && typeof v === 'object' && !Array.isArray(v) &&
    Object.values(v as Record<string, unknown>).every((n) => typeof n === 'number' && Number.isFinite(n));
}

const MIN_ROW_HEIGHT = 90;
const MAX_ROW_HEIGHT = 900;
/** A partir dessa altura (ajustada pelo usuário) os cards mostram horário e detalhamento. */
const EXPAND_FROM = 150;

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
  resolveEventImages,
  resolveCover,
  resolveBreadcrumb,
  onEventDoubleClick,
  onEventClick,
  onDayClick,
  onEventEdit,
  onCreateEvent,
  onEventProjectClick,
  onEventChange,
  onEventDuplicate,
  onProjectAssign,
  onEventRequestDelete,
  onEventHistory,
  onProjectDrop,
}: MonthViewProps) {
  const weeks = getMonthMatrix(anchor);
  const [hoveredDayKey, setHoveredDayKey] = useState<string | null>(null);
  // altura ajustada manualmente por semana (chave = primeiro dia da semana); sem entrada = divide o espaço restante.
  // Fica salva no localStorage, então volta igual ao reabrir o app.
  const [rowHeights, setRowHeights] = usePersistentState<Record<string, number>>('agenda.month.rowHeights', {}, isHeightMap);

  // zoom: Ctrl + scroll sobre uma semana muda a altura dela (e, ampliada, a escala da grade de horas). Ctrl + 0 restaura.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return;
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-week-key]');
      if (!row) return;
      e.preventDefault();
      const key = row.dataset.weekKey!;
      const measured = row.getBoundingClientRect().height;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setRowHeights((prev) => {
        const base = prev[key] ?? measured;
        const next = Math.round(Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, base * factor)));
        return prev[key] === next ? prev : { ...prev, [key]: next };
      });
    }
    function onKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.key !== '0') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      setRowHeights({});
    }
    root.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [setRowHeights]);

  // scroll da grade de horas sincronizado entre os dias da mesma semana (guardado em minutos: sobrevive a mudança de escala)
  const scrollers = useRef<Map<string, Set<HTMLDivElement>>>(new Map());
  const scrollMinByWeek = useRef<Record<string, number>>({});
  const syncingScroll = useRef(false);
  const [infoPopup, setInfoPopup] = useState<{ id: string; cover: string | null } | null>(null);
  const infoEvent = infoPopup ? events.find((e) => e.id === infoPopup.id) ?? null : null;

  function registerScroller(key: string, el: HTMLDivElement) {
    if (!scrollers.current.has(key)) scrollers.current.set(key, new Set());
    scrollers.current.get(key)!.add(el);
  }
  function unregisterScroller(key: string, el: HTMLDivElement) {
    scrollers.current.get(key)?.delete(el);
  }
  function handleGridScroll(key: string, el: HTMLDivElement, hourHeight: number) {
    if (syncingScroll.current) return;
    scrollMinByWeek.current[key] = (el.scrollTop / hourHeight) * 60;
    syncingScroll.current = true;
    scrollers.current.get(key)?.forEach((other) => {
      if (other !== el) other.scrollTop = el.scrollTop;
    });
    requestAnimationFrame(() => { syncingScroll.current = false; });
  }
  /** Semana de hoje: perto da hora atual. Outras: primeira hora com evento (menos 30 min), ou meia-noite. */
  function defaultScrollMin(week: Date[]): number {
    // semana de hoje: abre perto da hora atual, onde está a linha vermelha
    const now = new Date();
    if (week.some((d) => isSameDay(d, now))) return Math.max(0, now.getHours() * 60 + now.getMinutes() - 120);
    let earliest = Infinity;
    for (const d of week) {
      for (const ev of events) {
        const st = fromLocalISO(ev.start_at);
        if (isSameDay(st, d)) earliest = Math.min(earliest, minutesSinceMidnight(st));
      }
    }
    return Number.isFinite(earliest) ? Math.max(0, earliest - 30) : 0;
  }

  /** Soltou um chip sobre um dia: move (mantém horário e duração) ou, com Alt, copia. */
  function handleChipDrop(ev: Event, dayKey: string, copy: boolean) {
    const day = weeks.flat().find((d) => d.toDateString() === dayKey);
    if (!day) return;
    const { startAt, endAt } = moveEventToDay(ev, day);
    if (copy) onEventDuplicate(ev, startAt, endAt);
    else if (!isSameDay(fromLocalISO(ev.start_at), day)) onEventChange(ev.id, startAt, endAt);
  }

  function beginRowResize(e: ReactPointerEvent<HTMLDivElement>, key: string) {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    const row = handle.parentElement as HTMLElement;
    const startY = e.clientY;
    const startH = row.getBoundingClientRect().height;
    const pointerId = e.pointerId;
    handle.setPointerCapture(pointerId);

    const onMove = (ev: PointerEvent) => {
      const h = Math.round(Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, startH + ev.clientY - startY)));
      setRowHeights((prev) => (prev[key] === h ? prev : { ...prev, [key]: h }));
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      try { handle.releasePointerCapture(pointerId); } catch { /* já liberado */ }
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  function resetRowHeight(key: string) {
    setRowHeights((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="border-b border-gray-200 dark:border-gray-700" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flexShrink: 0 }}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
          <div key={d} className="text-gray-700 dark:text-gray-300" style={{ textAlign: 'center', padding: 8, fontWeight: 600, fontSize: 13 }}>{d}</div>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {weeks.map((week) => {
          const weekKey = week[0].toDateString();
          const customHeight = rowHeights[weekKey];
          const expanded = (customHeight ?? 0) >= EXPAND_FROM;
          // escala da grade de horas: ~8h visíveis na altura da linha, entre 24 e 64 px por hora
          const hourHeight = Math.min(64, Math.max(24, Math.round(((customHeight ?? 0) - 28) / 8)));
          const weekScrollMin = expanded ? (scrollMinByWeek.current[weekKey] ?? defaultScrollMin(week)) : 0;
          return (
            <div
              key={weekKey}
              data-week-key={weekKey}
              className="relative border-b border-gray-200 dark:border-gray-800"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gridTemplateRows: 'minmax(0, 1fr)',
                minHeight: MIN_ROW_HEIGHT,
                flex: customHeight ? `0 0 ${customHeight}px` : '1 1 0',
              }}
            >
              {week.map((day, di) => {
                const dayEvents = events.filter((ev) => isSameDay(new Date(ev.start_at), day));
                const inMonth = day.getMonth() === anchor.getMonth();

                return (
                  <div
                    key={di}
                    data-month-day={day.toDateString()}
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

                      const projectId = e.dataTransfer.getData(PROJECT_DRAG_ID_KEY);
                      if (projectId) {
                        const projectName = e.dataTransfer.getData(PROJECT_DRAG_NAME_KEY);
                        // Sem grade de horas na view mês — usa o mesmo horário
                        // padrão (9h–10h) do clique-pra-criar já existente aqui.
                        const start = new Date(day);
                        start.setHours(9, 0, 0, 0);
                        const end = new Date(day);
                        end.setHours(10, 0, 0, 0);
                        onProjectDrop(projectId, projectName, start, end);
                        return;
                      }

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
                    className={[
                      'border-l border-gray-200 dark:border-gray-800',
                      hoveredDayKey === day.toDateString()
                        ? 'bg-[#e8f0fe] dark:bg-blue-900/30'
                        : inMonth ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-black/20',
                      inMonth ? 'text-black dark:text-gray-100' : 'text-gray-400 dark:text-gray-600',
                    ].join(' ')}
                    style={{
                      padding: 4,
                      minHeight: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onDayClick(day);
                      }}
                      className={isToday(day) ? 'text-white' : inMonth ? 'text-black dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'}
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 4,
                        flexShrink: 0,
                        alignSelf: 'flex-start',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        backgroundColor: isToday(day) ? '#1a73e8' : 'transparent',
                      }}
                    >
                      {day.getDate()}
                    </div>
                    {expanded ? (
                      <MonthDayGrid
                        day={day}
                        week={week}
                        dayIndex={di}
                        events={events}
                        hourHeight={hourHeight}
                        scrollMin={weekScrollMin}
                        registerScroller={(el) => registerScroller(weekKey, el)}
                        unregisterScroller={(el) => unregisterScroller(weekKey, el)}
                        onScrolled={(el, hh) => handleGridScroll(weekKey, el, hh)}
                        resolveColor={resolveColor}
                        resolveCover={resolveCover}
                        resolveEventImages={resolveEventImages}
                        resolveBreadcrumb={resolveBreadcrumb}
                        onEventEdit={onEventEdit}
                        onEventProjectClick={onEventProjectClick}
                        onEventDoubleClick={onEventDoubleClick}
                        onEventClick={onEventClick}
                        onEventChange={onEventChange}
                        onEventDuplicate={onEventDuplicate}
                        onProjectAssign={onProjectAssign}
                        onEventRequestDelete={onEventRequestDelete}
                        onOpenInfoPopup={(ev, cover) => setInfoPopup({ id: ev.id, cover: cover ?? null })}
                        onOpenHistory={onEventHistory}
                      />
                    ) : (
                      <div className="[scrollbar-width:thin]" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                        {dayEvents.map((ev) => (
                          <MonthEventChip
                            key={ev.id}
                            event={ev}
                            color={resolveColor(ev.project_id)}
                            images={resolveEventImages(ev)}
                            fallbackCover={resolveCover(ev.project_id)}
                            breadcrumb={resolveBreadcrumb(ev.project_id)}
                            onEdit={onEventEdit}
                            onProjectClick={onEventProjectClick}
                            onDoubleClick={onEventDoubleClick}
                            onEventClick={onEventClick}
                            onProjectAssign={onProjectAssign}
                            onRequestDelete={onEventRequestDelete}
                            onOpenHistory={onEventHistory}
                            onDropToDay={handleChipDrop}
                            onDragHover={setHoveredDayKey}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <div
                onPointerDown={(e) => beginRowResize(e, weekKey)}
                onDoubleClick={() => resetRowHeight(weekKey)}
                title="Arraste para ajustar a altura · duplo clique restaura"
                className="absolute inset-x-0 bottom-0 z-20 h-1.5 cursor-ns-resize hover:bg-blue-500/40"
                style={{ touchAction: 'none' }}
              />
            </div>
          );
        })}
      </div>

      <EventInfoPopup
        event={infoEvent}
        color={infoEvent ? resolveColor(infoEvent.project_id) : '#888888'}
        breadcrumb={infoEvent ? resolveBreadcrumb(infoEvent.project_id) : []}
        cover={infoPopup?.cover ?? null}
        onClose={() => setInfoPopup(null)}
      />
    </div>
  );
}
