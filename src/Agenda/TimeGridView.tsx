import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { Event } from '@/types/event.types';
import { snapMinutes, formatHourLabel, formatMinutesLabel, isSameDay, fromLocalISO, toLocalISO, addDays, formatDuration, minutesSinceMidnight } from '../lib/utils/date';
import EventBlock from './EventBlock';
import { useNow } from '@/lib/hooks/useNow';
import { ProjectType } from '@/types/project.types';
import { convertFileSrc } from '@tauri-apps/api/core';
import WeekSummaryModal from './WeekSummaryModal';
import { computeOverlapLevels, getVisualRange } from './utils/eventLayout';
import WeekComparisonModal from './components/WeekComparisonModal';
import { useGhostEventSuggestion } from './hooks/useGhostEventSuggestion';
import { usePersistentState } from './hooks/usePersistentState';
import { PROJECT_DRAG_ID_KEY, PROJECT_DRAG_NAME_KEY } from './components/AgendaProjectSidebar';

// Zoom (Ctrl + scroll do mouse): altura de 1 hora na grade, em px
const DEFAULT_HOUR_HEIGHT = 48;
const MIN_HOUR_HEIGHT = 20;
const MAX_HOUR_HEIGHT = 240;

function isHourHeight(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= MIN_HOUR_HEIGHT && v <= MAX_HOUR_HEIGHT;
}
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface SharedBoundaryHandleProps {
  upperEvent: Event;
  lowerEvent: Event;
  boundaryMin: number;
  left: number;
  hourHeight: number;
  onChange: (id: string, startAt: string, endAt: string) => void;
}

/**
 * Handle fino na borda entre dois eventos "encostados" no mesmo dia (o fim
 * de um coincide com o início do outro). Arrastar move a fronteira dos
 * dois ao mesmo tempo — estica um lado e encolhe o outro pela mesma
 * quantidade, sem separar nem sobrepor os eventos. Cada lado ainda respeita
 * o mínimo de 15min de duração, igual aos handles individuais do EventBlock.
 */
function SharedBoundaryHandle({ upperEvent, lowerEvent, boundaryMin, left, hourHeight, onChange }: SharedBoundaryHandleProps) {
  const [deltaMin, setDeltaMin] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const dragStartY = useRef(0);
  const pxPerMin = hourHeight / 60;

  const upperDurationMin = Math.round(
    (fromLocalISO(upperEvent.end_at).getTime() - fromLocalISO(upperEvent.start_at).getTime()) / 60000
  );
  const lowerDurationMin = Math.round(
    (fromLocalISO(lowerEvent.end_at).getTime() - fromLocalISO(lowerEvent.start_at).getTime()) / 60000
  );

  function beginDrag(e: React.PointerEvent) {
    e.stopPropagation();
    dragStartY.current = e.clientY;
    const minExtra = -(upperDurationMin - 15);
    const maxExtra = lowerDurationMin - 15;

    const handleMove = (ev: PointerEvent) => {
      const raw = snapMinutes((ev.clientY - dragStartY.current) / pxPerMin);
      setDeltaMin(Math.min(maxExtra, Math.max(minExtra, raw)));
    };

    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);

      const raw = snapMinutes((ev.clientY - dragStartY.current) / pxPerMin);
      const extra = Math.min(maxExtra, Math.max(minExtra, raw));

      if (extra !== 0) {
        const newUpperEnd = new Date(fromLocalISO(upperEvent.end_at).getTime() + extra * 60000);
        const newLowerStart = new Date(fromLocalISO(lowerEvent.start_at).getTime() + extra * 60000);
        onChange(upperEvent.id, upperEvent.start_at, toLocalISO(newUpperEnd));
        onChange(lowerEvent.id, toLocalISO(newLowerStart), lowerEvent.end_at);
      }
      setDeltaMin(0);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  const isDragging = deltaMin !== 0;

  return (
    <div
      onPointerDown={(e) => e.button === 0 && beginDrag(e)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{
        position: 'absolute',
        top: (boundaryMin + deltaMin) * pxPerMin - 4,
        height: 8,
        left,
        right: 2,
        cursor: 'ns-resize',
        zIndex: 6,
      }}
    >
      {(isHovering || isDragging) && (
        <div style={{ position: 'absolute', top: 3, left: 0, right: 0, height: 2, backgroundColor: '#1a73e8', borderRadius: 1 }} />
      )}
      {isDragging && (
        <div style={{ position: 'absolute', top: -18, left: 0, backgroundColor: '#333', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none' }}>
          {formatMinutesLabel(boundaryMin + deltaMin)}
        </div>
      )}
    </div>
  );
}

interface TimeGridViewProps {
  days: Date[];
  events: Event[];
  resolveColor: (projectId: string | null) => string;
  resolveCover: (projectId: string | null) => string | null;
  resolveEventImages: (event: Event) => string[];
  resolveBreadcrumb: (projectId: string | null) => ProjectType[];
  onCreateEvent: (start: Date, end: Date) => void;
  onEventEdit: (event: Event) => void;
  onEventProjectClick: (event: Event) => void;
  onEventDoubleClick: (event: Event) => void;
  onEventClick: (event: Event) => void;
  onEventChange: (id: string, startAt: string, endAt: string) => void;
  onEventDuplicate: (event: Event, startAt: string, endAt: string) => void;
  onProjectAssign: (eventId: string, projectId: string | null) => void;
  onProjectSummaryClick: (projectId: string | null) => void;
  onEventRequestDelete: (event: Event) => void;
  onCreateSuggested: (data: { title: string; project_id: string | null; start_at: string; end_at: string }) => void;
  onDescriptionChange: (id: string, description: string) => void;
  onOpenInfoPopup: (event: Event, cover?: string | null) => void;
  onEventHistory?: (event: Event) => void;
  onProjectDrop: (projectId: string, projectName: string, start: Date, end: Date) => void;
}

interface GhostEventBlockProps {
  title: string;
  color: string;
  top: number;
  height: number;
  onClick: () => void;
}

/**
 * Bloco fantasma: sugestão de evento repetido, em opacidade reduzida.
 * Clicar cria o evento de verdade na hora, sem passar por confirmação.
 */
function GhostEventBlock({ title, color, top, height, onClick }: GhostEventBlockProps) {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      title={`Criar "${title}" de novo (repetiu nos dias anteriores)`}
      style={{
        position: 'absolute',
        top,
        height: Math.max(16, height),
        left: 2,
        right: 2,
        backgroundColor: color,
        opacity: isHovering ? 0.55 : 0.3,
        transition: 'opacity 120ms ease',
        border: '1px dashed rgba(255,255,255,0.85)',
        borderRadius: 4,
        color: '#fff',
        fontSize: 12,
        padding: '2px 6px',
        cursor: 'pointer',
        zIndex: 1,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        userSelect: 'none',
      }}
    >
      {title}
    </div>
  );
}


export default function TimeGridView({
  days, events, resolveColor, resolveCover, onCreateEvent, resolveBreadcrumb,
  resolveEventImages,
  onEventEdit, onEventProjectClick, onEventDoubleClick, onEventClick, onEventChange, onEventDuplicate,
  onProjectAssign, onProjectSummaryClick, onEventRequestDelete, onCreateSuggested, onDescriptionChange, onOpenInfoPopup, onEventHistory, onProjectDrop,
}: TimeGridViewProps) {
  const [draft, setDraft] = useState<{ dayIndex: number; startMin: number; currentMin: number } | null>(null);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);

  // ---- zoom: Ctrl + scroll muda a altura da hora (salva); Ctrl + 0 volta ao padrão ----
  const [hourHeight, setHourHeight] = usePersistentState<number>('agenda.hourHeight', DEFAULT_HOUR_HEIGHT, isHourHeight);
  const renderedHourHeight = useRef(hourHeight);   // o que está desenhado agora
  const zoomTarget = useRef(hourHeight);           // alvo (vários eventos de scroll antes do próximo render)
  const zoomAnchor = useRef<{ minutes: number; offset: number } | null>(null);

  // depois de redesenhar com a nova escala, mantém o horário sob o cursor no mesmo lugar da tela
  useLayoutEffect(() => {
    renderedHourHeight.current = hourHeight;
    zoomTarget.current = hourHeight;
    const el = gridRef.current;
    const anchor = zoomAnchor.current;
    if (el && anchor) el.scrollTop = Math.max(0, (anchor.minutes / 60) * hourHeight - anchor.offset);
    zoomAnchor.current = null;
  }, [hourHeight]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return;
      e.preventDefault(); // listener não-passivo: impede o zoom da página
      const next = Math.round(
        Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, zoomTarget.current * Math.exp(-e.deltaY * 0.0015))) * 100,
      ) / 100;
      if (next === zoomTarget.current) return;
      zoomTarget.current = next;
      if (!zoomAnchor.current && el) {
        const offset = e.clientY - el.getBoundingClientRect().top;
        zoomAnchor.current = { minutes: ((el.scrollTop + offset) / renderedHourHeight.current) * 60, offset };
      }
      setHourHeight(next);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.key !== '0') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      zoomTarget.current = DEFAULT_HOUR_HEIGHT;
      setHourHeight(DEFAULT_HOUR_HEIGHT);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [setHourHeight]);
  const [hoverMinutes, setHoverMinutes] = useState<number | null>(null);

  const CREATE_ZONE_WIDTH = 24;
  function getColumnWidth(): number {
    return columnRefs.current[0]?.getBoundingClientRect().width ?? 0;
  }

  function yToMinutes(dayIndex: number, clientY: number): number {
    const col = columnRefs.current[dayIndex];
    if (!col) return 0;
    const rect = col.getBoundingClientRect();
    const raw = ((clientY - rect.top) / hourHeight) * 60;
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
    const raw = (y / hourHeight) * 60;
    setHoverMinutes(snapMinutes(Math.max(0, Math.min(24 * 60 - 1, raw)), 5));
  }

  function handleGridMouseLeave() {
    setHoverMinutes(null);
  }

  const now = useNow();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayIndex = days.findIndex((d) => isSameDay(d, now));

  const todayEventsForGhost = events.filter((ev) => isSameDay(fromLocalISO(ev.start_at), now));
  const ghostSuggestion = useGhostEventSuggestion(todayEventsForGhost, now, todayIndex !== -1);

  function handleGhostClick() {
    if (!ghostSuggestion) return;
    const start = new Date(now);
    start.setHours(0, ghostSuggestion.startMin, 0, 0);
    const end = new Date(now);
    end.setHours(0, ghostSuggestion.endMin, 0, 0);
    onCreateSuggested({
      title: ghostSuggestion.title,
      project_id: ghostSuggestion.projectId,
      start_at: toLocalISO(start),
      end_at: toLocalISO(end),
    });
  }

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
  const [comparisonOpen, setComparisonOpen] = useState(false);
  // Resumo por dia (rodapé) começa recolhido, mostrando só o total; cada dia
  // expande/recolhe independente pra ver o detalhamento por projeto.
  const [expandedSummaryDays, setExpandedSummaryDays] = useState<Set<number>>(new Set());

  function toggleSummaryDay(dayIndex: number) {
    setExpandedSummaryDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayIndex)) next.delete(dayIndex);
      else next.add(dayIndex);
      return next;
    });
  }

  useEffect(() => {
    const el = gridRef.current;
    if (!el || todayIndex === -1) return;
    const targetScrollTop = (nowMinutes / 60) * hourHeight - el.clientHeight / 2;
    el.scrollTop = Math.max(0, targetScrollTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]); // só re-centraliza quando o range de dias muda (troca de view/navegação), não a cada minuto

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {days.length > 1 && (
        <div className="flex flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setWeekSummaryOpen(true)}
            className="flex flex-1 items-center justify-between border-none bg-[#eef2f7] dark:bg-gray-800 px-3 py-2 cursor-pointer"
          >
            <span className="text-xs text-gray-600 dark:text-gray-300">
              📊 {weekEventCount} evento{weekEventCount !== 1 ? 's' : ''} nesta semana
            </span>
            <span title="semana contem 168 horas" className="text-sm font-bold text-blue-600 dark:text-blue-400">
              Total: {weekTotalMinutes > 0 ? formatDuration(weekTotalMinutes) : '—'}
            </span>
          </button>
          <button
            onClick={() => setComparisonOpen(true)}
            className="flex-shrink-0 border-none border-l border-gray-200 dark:border-gray-700 bg-[#eef2f7] dark:bg-gray-800 px-3 py-2 cursor-pointer text-xs text-gray-600 dark:text-gray-300"
          >
            📈 Comparar semanas
          </button>
        </div>
      )}

      <div className="border-b border-gray-200 dark:border-gray-700" style={{ display: 'flex', flexShrink: 0 }}>
        <div style={{ width: 56 }} />
        {days.map((day, i) => (
          <div
            key={i}
            className="border-l border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400"
            style={{ flex: 1, textAlign: 'center', padding: '6px 4px', fontSize: 11 }}
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
            <div key={h} className="text-gray-600 dark:text-gray-400" style={{ height: hourHeight, fontSize: 11, textAlign: 'right', paddingRight: 4, transform: 'translateY(-6px)' }}>
              {formatHourLabel(h)}
            </div>
          ))}

          {hoverMinutes !== null && !draft && (
            <div
              className="bg-white dark:bg-gray-900"
              style={{
                position: 'absolute',
                top: (hoverMinutes / 60) * hourHeight - 6,
                right: 4,
                fontSize: 11,
                fontWeight: 700,
                color: '#ea4335',
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
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(PROJECT_DRAG_ID_KEY)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              const projectId = e.dataTransfer.getData(PROJECT_DRAG_ID_KEY);
              if (!projectId) return;
              e.preventDefault();
              const projectName = e.dataTransfer.getData(PROJECT_DRAG_NAME_KEY);
              // limita o início pra o evento de 1h padrão não cruzar meia-noite
              const startMin = Math.min(yToMinutes(dayIndex, e.clientY), 24 * 60 - 60);
              const start = new Date(day);
              start.setHours(0, startMin, 0, 0);
              const end = new Date(start.getTime() + 60 * 60000);
              onProjectDrop(projectId, projectName, start, end);
            }}
            className={
              'border-l border-gray-200 dark:border-gray-800 ' +
              (dayIndex === todayIndex ? 'bg-[rgba(26,115,232,0.04)] dark:bg-[rgba(26,115,232,0.12)]' : '')
            }
            style={{
              flex: 1,
              position: 'relative',
              height: hourHeight * 24,
            }}
          >
            {HOURS.map((h) => (
              <div key={h} className="border-t border-gray-100 dark:border-gray-800" style={{ position: 'absolute', top: h * hourHeight, left: 0, right: 0, height: hourHeight }} />
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

              const eventBlocks = allSegments.map(({ event: ev, segmentKind }) => (
                <EventBlock
                  key={`${ev.id}-${segmentKind}`}
                  event={ev}
                  hourHeight={hourHeight}
                  color={resolveColor(ev.project_id)}
                  images={resolveEventImages(ev)}
                  fallbackCover={resolveCover(ev.project_id)}
                  breadcrumb={resolveBreadcrumb(ev.project_id)}
                  days={days}
                  dayIndex={dayIndex}
                  getColumnWidth={getColumnWidth}
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
                  onDescriptionChange={onDescriptionChange}
                  onOpenInfoPopup={onOpenInfoPopup}
                  onOpenHistory={onEventHistory}
                />
              ));

              // Pares de eventos "encostados" neste dia (fim de um = início do
              // outro), só entre segmentos "start" que não cruzam meia-noite
              // do lado de cima — mesma regra do canResizeBottom do EventBlock.
              const sharedBoundaries: ReactElement[] = [];
              for (const upper of startSegments) {
                const upperEvent = upper.event;
                const upperStart = fromLocalISO(upperEvent.start_at);
                const upperEnd = fromLocalISO(upperEvent.end_at);
                if (!isSameDay(upperStart, upperEnd)) continue;

                const boundaryMin = minutesSinceMidnight(upperEnd);
                const lower = startSegments.find(
                  (s) => s.event.id !== upperEvent.id && minutesSinceMidnight(fromLocalISO(s.event.start_at)) === boundaryMin
                );
                if (!lower) continue;

                const upperLevel = levels[`${upperEvent.id}-start`] ?? 0;
                const lowerLevel = levels[`${lower.event.id}-start`] ?? 0;

                sharedBoundaries.push(
                  <SharedBoundaryHandle
                    key={`boundary-${upperEvent.id}-${lower.event.id}`}
                    upperEvent={upperEvent}
                    lowerEvent={lower.event}
                    boundaryMin={boundaryMin}
                    left={2 + Math.min(upperLevel, lowerLevel) * 14}
                    hourHeight={hourHeight}
                    onChange={onEventChange}
                  />
                );
              }

              return [...eventBlocks, ...sharedBoundaries];
            })()}
            {dayIndex === todayIndex && ghostSuggestion && (
              <GhostEventBlock
                title={ghostSuggestion.title}
                color={resolveColor(ghostSuggestion.projectId)}
                top={(ghostSuggestion.startMin / 60) * hourHeight}
                height={((ghostSuggestion.endMin - ghostSuggestion.startMin) / 60) * hourHeight}
                onClick={handleGhostClick}
              />
            )}
            {dayIndex === todayIndex && (
              <div
                style={{
                  position: 'absolute',
                  top: (nowMinutes / 60) * hourHeight,
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
                  top: (draft.startMin / 60) * hourHeight,
                  height: ((draft.currentMin - draft.startMin) / 60) * hourHeight,
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

      <div className="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800" style={{ display: 'flex', flexShrink: 0 }}>
        <div style={{ width: 56 }} />
        {days.map((_, i) => {
          const summary = daySummaries[i];
          const isExpanded = expandedSummaryDays.has(i);

          const projectsSorted = summary ? Object.values(summary.byProject).sort((a, b) => b.minutes - a.minutes) : [];
          return (
            <div
              key={i}
              className="border-l border-gray-200 dark:border-gray-700"
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '6px 4px',
                fontSize: 11,
                color: '#fff',
                maxHeight: isExpanded ? 100 : undefined,
                overflowY: isExpanded ? 'auto' : undefined,
              }}
            >
              {summary ? (
                <>
                  <button
                    onClick={() => toggleSummaryDay(i)}
                    className="text-blue-600 dark:text-blue-400"
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                      fontSize: 12, fontWeight: 700,
                    }}
                  >
                    {formatDuration(summary.totalMinutes)}
                    <span style={{ fontSize: 9, transition: 'transform 150ms', transform: isExpanded ? 'rotate(180deg)' : undefined }}>▾</span>
                  </button>

                  {isExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', paddingLeft: 4, marginTop: 4 }}>
                      {projectsSorted.map((p) => {
                        const cover = resolveCover(p.projectId);
                        const color = resolveColor(p.projectId);
                        return (
                          <div
                            key={p.projectId ?? '__none__'}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, backgroundColor: color, borderRadius: 4, padding: '2px 4px', cursor: 'pointer' }}
                            className="border hover:border-black dark:hover:border-white"
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
                  )}
                </>
              ) : (
                <span className="text-gray-300 dark:text-gray-600">—</span>
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
      {days.length > 1 && (
        <WeekComparisonModal
          isOpen={comparisonOpen}
          onClose={() => setComparisonOpen(false)}
          weekStart={days[0]}
          days={days}
          currentWeekEvents={events}
          resolveColor={resolveColor}
          resolveBreadcrumb={resolveBreadcrumb}
        />
      )}
    </div>
  );
}
