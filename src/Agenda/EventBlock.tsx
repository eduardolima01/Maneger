import { useRef, useState } from 'react';
import type { Event } from '@/types/event.types';
import { fromLocalISO, toLocalISO, minutesSinceMidnight, snapMinutes } from '../lib/utils/date';

interface EventBlockProps {
  event: Event;
  hourHeight: number;
  onClick: (event: Event) => void;
  onChange: (id: number, startAt: string, endAt: string) => void;
}

export default function EventBlock({ event, hourHeight, onClick, onChange }: EventBlockProps) {
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
      onClick={(e) => {
        e.stopPropagation();
        if (dragOffsetMin === 0 && resizeExtraMin === 0) onClick(event);
      }}
      style={{
        position: 'absolute',
        top,
        height,
        left: 2,
        right: 2,
        backgroundColor: '#1a73e8',
        color: '#fff',
        borderRadius: 4,
        padding: '2px 6px',
        fontSize: 12,
        overflow: 'hidden',
        cursor: 'grab',
        userSelect: 'none',
        zIndex: 2,
      }}
    >
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
