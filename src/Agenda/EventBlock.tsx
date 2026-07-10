import { useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Event } from '@/types/event.types';
import { fromLocalISO, toLocalISO, minutesSinceMidnight, snapMinutes, formatMinutesLabel } from '../lib/utils/date';

interface EventBlockProps {
  event: Event;
  hourHeight: number;
  color: string;
  coverPath: string | null;
  days: Date[];
  dayIndex: number;
  getColumnWidth: () => number;
  onEditClick: (event: Event) => void;
  onProjectClick: (event: Event) => void;
  onDoubleClick: (event: Event) => void;
  onChange: (id: string, startAt: string, endAt: string) => void;
  onDuplicate: (event: Event, startAt: string, endAt: string) => void;
}

export default function EventBlock({
  event, hourHeight, color, coverPath, days, dayIndex, getColumnWidth,
  onEditClick, onProjectClick, onDoubleClick, onChange, onDuplicate,
}: EventBlockProps) {
  const start = fromLocalISO(event.start_at);
  const end = fromLocalISO(event.end_at);
  const startMin = minutesSinceMidnight(start);
  const durationMin = Math.max(15, minutesSinceMidnight(end) - startMin || (24 * 60 - startMin));

  const [dragOffsetMin, setDragOffsetMin] = useState(0);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [resizeExtraMin, setResizeExtraMin] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const dragMode = useRef<'move' | 'resize' | null>(null);
  const dragStartY = useRef(0);
  const dragStartX = useRef(0);


  const pxPerMin = hourHeight / 60;

  function beginDrag(mode: 'move' | 'resize', e: React.PointerEvent) {
    e.stopPropagation();
    dragMode.current = mode;
    dragStartY.current = e.clientY;
    dragStartX.current = e.clientX;
    setDragOffsetMin(0);
    setDragOffsetX(0);
    setResizeExtraMin(0);

    const columnWidth = getColumnWidth();

    const handleMove = (ev: PointerEvent) => {
      const deltaMin = snapMinutes((ev.clientY - dragStartY.current) / pxPerMin);
      if (dragMode.current === 'move') {
        setDragOffsetMin(deltaMin);
        setDragOffsetX(ev.clientX - dragStartX.current);
      }
      if (dragMode.current === 'resize') setResizeExtraMin(Math.max(15 - durationMin, deltaMin));
    };

    const handleUp = (ev: PointerEvent) => {
      const deltaMin = snapMinutes((ev.clientY - dragStartY.current) / pxPerMin);
      const deltaX = ev.clientX - dragStartX.current;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);

      if (dragMode.current === 'move' && (deltaMin !== 0 || Math.abs(deltaX) >= columnWidth / 2)) {
        const dayDelta = columnWidth > 0 ? Math.round(deltaX / columnWidth) : 0;
        const targetDayIndex = Math.min(days.length - 1, Math.max(0, dayIndex + dayDelta));
        const targetDay = days[targetDayIndex];

        const newStart = new Date(targetDay);
        newStart.setHours(0, startMin + deltaMin, 0, 0);
        const newEnd = new Date(newStart.getTime() + durationMin * 60000);

        if (ev.altKey) {
          onDuplicate(event, toLocalISO(newStart), toLocalISO(newEnd));
        } else {
          onChange(event.id, toLocalISO(newStart), toLocalISO(newEnd));
        }
      } else if (dragMode.current === 'resize' && deltaMin !== 0) {
        const extra = Math.max(15 - durationMin, deltaMin);
        const newEnd = new Date(end.getTime() + extra * 60000);
        onChange(event.id, event.start_at, toLocalISO(newEnd));
      }

      dragMode.current = null;
      setDragOffsetMin(0);
      setDragOffsetX(0);
      setResizeExtraMin(0);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  const top = (startMin + dragOffsetMin) * pxPerMin;
  const height = Math.max(16, (durationMin + resizeExtraMin) * pxPerMin);

  const isDraggingMove = dragOffsetMin !== 0 || dragOffsetX !== 0;
  const isResizing = resizeExtraMin !== 0;
  const showHoverTooltip = isHovering && !isDraggingMove && !isResizing;
  const previewStartMin = startMin + dragOffsetMin;
  const previewEndMin = previewStartMin + durationMin;
  const previewResizeEndMin = startMin + durationMin + resizeExtraMin;

  return (
    <div
      onPointerDown={(e) => beginDrag('move', e)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(event);
      }}
      className="group"
      style={{
        position: 'absolute',
        top,
        height,
        left: 2,
        right: 2,
        backgroundColor: color,
        color: '#fff',
        borderRadius: 4,
        padding: '2px 6px',
        fontSize: 12,
        // overflow: 'hidden',
        cursor: 'pointer',
        userSelect: 'none',
        zIndex: 2,
        transform: dragOffsetX ? `translateX(${dragOffsetX}px)` : undefined,
        boxShadow: dragOffsetX ? '0 4px 12px rgba(0,0,0,0.3)' : undefined,
      }}
    >

      {showHoverTooltip && (
        <div
          style={{
            position: 'absolute',
            top: -22,
            left: 0,
            backgroundColor: '#333',
            color: '#fff',
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {formatMinutesLabel(startMin)} – {formatMinutesLabel(startMin + durationMin)}
        </div>
      )}

      {isDraggingMove && (
        <div
          style={{
            position: 'absolute',
            top: -22,
            left: 0,
            backgroundColor: '#333',
            color: '#fff',
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {formatMinutesLabel(previewStartMin)} – {formatMinutesLabel(previewEndMin)}
        </div>
      )}

      {isResizing && (
        <div
          style={{
            position: 'absolute',
            bottom: -22,
            left: 0,
            backgroundColor: '#333',
            color: '#fff',
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          até {formatMinutesLabel(previewResizeEndMin)}
        </div>
      )}

      <span className="truncate flex items-center gap-1 pr-10">
        {coverPath && (
          <img
            src={convertFileSrc(coverPath)}
            className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
          />
        )}
        <span className="truncate">{event.title}</span>
      </span>

      <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onEditClick(event);
          }}
          title="Editar evento"
          className="w-4 h-4 flex items-center justify-center rounded bg-black/25 hover:bg-black/40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2.5 h-2.5">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>

        {event.project_id && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onProjectClick(event);
            }}
            title="Ir para o projeto"
            className="w-4 h-4 flex items-center justify-center rounded bg-black/25 hover:bg-black/40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2.5 h-2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
            </svg>
          </button>
        )}
      </div>

      <div
        onPointerDown={(e) => beginDrag('resize', e)}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 6,
          cursor: 'ns-resize',
        }}
      />
    </div>
  );
}
