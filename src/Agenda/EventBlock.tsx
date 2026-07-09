import { useRef, useState } from 'react';
import type { Event } from '@/types/event.types';
import { fromLocalISO, toLocalISO, minutesSinceMidnight, snapMinutes } from '../lib/utils/date';
import Button from '@/components/layout/Button';
import { FaProjectDiagram } from 'react-icons/fa';

interface EventBlockProps {
  event: Event;
  hourHeight: number;
  color: string;
  onEditClick: (event: Event) => void;
  onProjectClick: (event: Event) => void;
  onChange: (id: string, startAt: string, endAt: string) => void;
}

export default function EventBlock({
  event,
  hourHeight,
  color,
  onEditClick,
  onProjectClick,
  onChange
}: EventBlockProps) {
  const start = fromLocalISO(event.start_at);
  const end = fromLocalISO(event.end_at);
  const startMin = minutesSinceMidnight(start);
  const durationMin = Math.max(15, minutesSinceMidnight(end) - startMin || (24 * 60 - startMin));

  const [dragOffsetMin, setDragOffsetMin] = useState(0);
  const [resizeExtraMin, setResizeExtraMin] = useState(0);
  const dragMode = useRef<'move' | 'resize' | null>(null);
  const dragStartY = useRef(0);

  const pxPerMin = hourHeight / 60;

  function beginDrag(mode: 'move' | 'resize', e: React.PointerEvent) {
    e.stopPropagation();
    dragMode.current = mode;
    dragStartY.current = e.clientY;
    setDragOffsetMin(0);
    setResizeExtraMin(0);

    const handleMove = (ev: PointerEvent) => {
      const deltaMin = snapMinutes((ev.clientY - dragStartY.current) / pxPerMin);
      if (dragMode.current === 'move') setDragOffsetMin(deltaMin);
      if (dragMode.current === 'resize') setResizeExtraMin(Math.max(15 - durationMin, deltaMin));
    };

    const handleUp = (ev: PointerEvent) => {
      const deltaMin = snapMinutes((ev.clientY - dragStartY.current) / pxPerMin);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);

      if (dragMode.current === 'move' && deltaMin !== 0) {
        const newStart = new Date(start.getTime() + deltaMin * 60000);
        const newEnd = new Date(end.getTime() + deltaMin * 60000);
        onChange(event.id, toLocalISO(newStart), toLocalISO(newEnd));
      } else if (dragMode.current === 'resize' && deltaMin !== 0) {
        const extra = Math.max(15 - durationMin, deltaMin);
        const newEnd = new Date(end.getTime() + extra * 60000);
        onChange(event.id, event.start_at, toLocalISO(newEnd));
      }

      dragMode.current = null;
      setDragOffsetMin(0);
      setResizeExtraMin(0);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  const top = (startMin + dragOffsetMin) * pxPerMin;
  const height = Math.max(16, (durationMin + resizeExtraMin) * pxPerMin);

  return (
    <div
      onPointerDown={(e) => beginDrag('move', e)}
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
        overflow: 'hidden',
        cursor: 'grab',
        userSelect: 'none',
        zIndex: 2,
      }}
      className="group"
    >
      <span className="truncate block pr-10">{event.title}</span>

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


      {event.title}
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
