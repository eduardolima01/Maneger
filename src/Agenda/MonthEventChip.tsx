import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  fromLocalISO,
  minutesSinceMidnight,
  formatMinutesLabel,
  formatDuration
} from '../lib/utils/date';
import type { Event } from '@/types/event.types';
import { ProjectType } from '@/types/project.types';
import ProjectSearchSelect from '@/Projects/components/ProjectSearchSelect';

interface MonthEventChipProps {
  event: Event;
  color: string;
  coverPath: string | null;
  breadcrumb: ProjectType[];
  onEdit: (event: Event) => void;
  onProjectClick: (event: Event) => void;
  onDoubleClick: (event: Event) => void;
  onProjectAssign: (eventId: string, projectId: string | null) => void;
}

export function MonthEventChip({
  event,
  color,
  coverPath,
  breadcrumb,
  onEdit,
  onProjectClick,
  onDoubleClick,
  onProjectAssign
}: MonthEventChipProps) {
  const [isHovering, setIsHovering] = useState(false);
  const start = fromLocalISO(event.start_at);
  const end = fromLocalISO(event.end_at);
  const startMin = minutesSinceMidnight(start);
  const endMin = minutesSinceMidnight(end);
  const durationMin = endMin >= startMin ? endMin - startMin : (1440 - startMin) + endMin;
  const assignedName = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].name : null;
  const fullPath = breadcrumb.map((p) => p.name).join(' / ');
  const [assignOpen, setAssignOpen] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', event.id);
        e.dataTransfer.effectAllowed = 'copyMove';
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(event);
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="group relative flex items-center justify-between"
      style={{ backgroundColor: color, color: '#fff', fontSize: 11, borderRadius: 3, padding: '1px 4px', marginBottom: 2, cursor: 'grab' }}
    >
      {isHovering && (
        <div
          style={{
            position: 'absolute',
            top: -20,
            left: 0,
            backgroundColor: '#333',
            color: '#fff',
            fontSize: 10,
            padding: '2px 5px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <div>{formatMinutesLabel(startMin)} – {formatMinutesLabel(endMin)} · {formatDuration(durationMin)}</div>
          {fullPath && <div style={{ opacity: 0.8 }}>📁 {fullPath}</div>}
        </div>
      )}

      {coverPath && (
        <img src={convertFileSrc(coverPath)} className="w-2.5 h-2.5 rounded-full object-cover shrink-0 mr-1" />
      )}
      <span className="truncate">{event.title}</span>

      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setAssignOpen((v) => !v); }}
          title="Atribuir projeto"
          className="w-3 h-3 flex items-center justify-center rounded bg-black/25 hover:bg-black/40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2 h-2">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
          </svg>
        </button>

        {assignOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', padding: 8, width: 200, zIndex: 30 }}
          >
            <ProjectSearchSelect
              value={event.project_id}
              onChange={(projectId) => { onProjectAssign(event.id, projectId); setAssignOpen(false); }}
            />
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(event);
          }}
          title="Editar evento"
          className="w-3 h-3 flex items-center justify-center rounded bg-black/25 hover:bg-black/40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2 h-2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        {event.project_id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onProjectClick(event);
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
  );
}
