import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import EventImageGalleryModal from './components/EventImageGalleryModal';
import EventInfoPopup from './components/EventInfoPopup';
import EventDetailsTimeline, { contrastText, suggestSlot } from './components/EventDetailsTimeline';
import { useEventDetails } from './hooks/useEventDetails';

interface MonthEventChipProps {
  event: Event;
  color: string;
  images: string[];
  fallbackCover: string | null;
  breadcrumb: ProjectType[];
  /** Linha do dia ampliada: mostra horário e o detalhamento dentro do card. */
  expanded?: boolean;
  /** Altura atual da linha do dia (px): define a escala (px/min) da linha do tempo dentro do card. */
  rowHeight?: number;
  onEdit: (event: Event) => void;
  onProjectClick: (event: Event) => void;
  onDoubleClick: (event: Event) => void;
  onEventClick: (event: Event) => void;
  onProjectAssign: (eventId: string, projectId: string | null) => void;
  onRequestDelete: (event: Event) => void;
  /** Soltou o chip sobre um dia (arrasto por ponteiro). `copy` = Alt pressionado. */
  /** Abre o histórico (tabela de ocorrências) do evento. O botão só aparece se vier. */
  onOpenHistory?: (event: Event) => void;
  onDropToDay?: (event: Event, dayKey: string, copy: boolean) => void;
  /** Dia sob o ponteiro durante o arrasto (null = nenhum), pra destacar a célula. */
  onDragHover?: (dayKey: string | null) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable);
}

export function MonthEventChip({
  event,
  color,
  images,
  fallbackCover,
  breadcrumb,
  expanded = false,
  rowHeight = 0,
  onEdit,
  onProjectClick,
  onDoubleClick,
  onEventClick,
  onProjectAssign,
  onRequestDelete,
  onOpenHistory,
  onDropToDay,
  onDragHover,
}: MonthEventChipProps) {
  const [isHovering, setIsHovering] = useState(false);
  const ctrlOnlyRef = useRef(true);
  const chipRef = useRef<HTMLDivElement>(null);
  // posição do chip na tela: tooltip e seletor de projeto são renderizados em portal (position: fixed)
  // porque a célula do dia agora tem scroll e cortaria qualquer filho absoluto.
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  // mouse sobre a linha do tempo: o chip deixa de ser arrastável (senão o arrastar de um detalhe vira drag do evento)
  const [dragLocked, setDragLocked] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number; copy: boolean } | null>(null);
  const displayImage = images[0] ?? fallbackCover;

  const start = fromLocalISO(event.start_at);
  const end = fromLocalISO(event.end_at);
  const startMin = minutesSinceMidnight(start);
  const endMin = minutesSinceMidnight(end);
  const durationMin = endMin >= startMin ? endMin - startMin : (1440 - startMin) + endMin;
  const fullPath = breadcrumb.map((p) => p.name).join(' / ');
  const [assignOpen, setAssignOpen] = useState(false);

  // só carrega o detalhamento quando o card está ampliado
  const { details, add, update, remove } = useEventDetails(event.id, expanded);
  // duração real (pode cruzar dias) — é a mesma que o popup usa pra escala da linha do tempo
  const totalMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const timelineTarget = Math.min(400, Math.max(100, rowHeight - 90));
  const pxPerMin = Math.min(6, Math.max(1.2, timelineTarget / Math.max(1, totalMin)));
  const snap = totalMin <= 15 ? 1 : 5;
  const palette = { text: contrastText(color), cardBg: color, border: 'rgba(0,0,0,0.3)' };

  async function handleAddDetail() {
    const slot = suggestSlot(details ?? [], totalMin);
    const id = await add(slot.start, slot.end);
    if (id) setFocusId(id);
  }

  useEffect(() => {
    // com o popup aberto os atalhos Q/Ctrl ficam desligados (senão digitar "q" no detalhamento apagaria o evento)
    if (!isHovering || infoOpen || dragLocked) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        onRequestDelete(event);
        return;
      }

      if (e.key === 'Control') { ctrlOnlyRef.current = true; return; }
      if (e.ctrlKey) ctrlOnlyRef.current = false;
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === 'Control' && ctrlOnlyRef.current) {
        onEdit(event);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isHovering, infoOpen, dragLocked, event, onRequestDelete, onEdit]);

  // Arrasto por ponteiro (não depende do drag-and-drop HTML5, que o Tauri pode interceptar no Windows).
  // Alt solto no momento do clique/soltura = copiar em vez de mover. Esc cancela.
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || dragLocked) return;
    if ((e.target as HTMLElement).closest('button')) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    const dayAt = (x: number, y: number) =>
      document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-month-day]')?.dataset.monthDay ?? null;

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      document.body.style.cursor = '';
      setDrag(null);
      onDragHover?.(null);
    };
    const onMove = (ev: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        dragging = true;
      }
      document.body.style.cursor = ev.altKey ? 'copy' : 'grabbing';
      setDrag({ x: ev.clientX, y: ev.clientY, copy: ev.altKey });
      onDragHover?.(dayAt(ev.clientX, ev.clientY));
    };
    const onUp = (ev: PointerEvent) => {
      const key = dragging ? dayAt(ev.clientX, ev.clientY) : null;
      cleanup();
      if (!dragging) return;
      // evita o "click" que o navegador dispara ao soltar (criaria um evento na célula)
      const swallow = (c: MouseEvent) => { c.stopPropagation(); c.preventDefault(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, true), 0);
      if (key) onDropToDay?.(event, key, ev.altKey);
    };
    const onCancel = () => cleanup();
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') cleanup(); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
  }

  const popoverBelow = anchor ? window.innerHeight - anchor.bottom > 260 : true;

  return (
    <div
      ref={chipRef}
      onPointerDown={handlePointerDown}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onEventClick(event); }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(event);
      }}
      onMouseEnter={() => {
        setAnchor(chipRef.current?.getBoundingClientRect() ?? null);
        setIsHovering(true);
      }}
      onMouseLeave={() => setIsHovering(false)}
      className="group relative"
      style={{ backgroundColor: color, color: '#fff', fontSize: 11, borderRadius: 3, padding: '1px 4px', marginBottom: 2, cursor: 'grab', userSelect: 'none' }}
    >
      {drag &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: drag.x + 12,
              top: drag.y + 12,
              backgroundColor: color,
              color: '#fff',
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
              opacity: 0.92,
              pointerEvents: 'none',
              zIndex: 100,
              maxWidth: 220,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {drag.copy ? '＋ ' : ''}{event.title}
          </div>,
          document.body,
        )}

      {isHovering && anchor && !infoOpen && !drag &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: Math.max(4, anchor.top - 24),
              left: Math.max(4, Math.min(anchor.left, window.innerWidth - 260)),
              backgroundColor: '#333',
              color: '#fff',
              fontSize: 10,
              padding: '2px 5px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              zIndex: 60,
              pointerEvents: 'none',
            }}
          >
            <div>{formatMinutesLabel(startMin)} – {formatMinutesLabel(endMin)} · {formatDuration(durationMin)}</div>
            {fullPath && <div style={{ opacity: 0.8 }}>📁 {fullPath}</div>}
          </div>,
          document.body,
        )}

      <div className="flex items-center justify-between">
        {displayImage && (
          <span
            onClick={(e) => { e.stopPropagation(); if (images.length > 0) setGalleryOpen(true); }}
            onContextMenu={(e) => e.stopPropagation()}
            style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, marginRight: 4, cursor: images.length > 0 ? 'zoom-in' : 'default' }}
          >
            <img src={convertFileSrc(displayImage)} className="w-4 h-4 rounded object-cover shrink-0" />
            {images.length > 1 && (
              <span style={{ position: 'absolute', bottom: -3, right: -3, fontSize: 8, lineHeight: '10px', padding: '0 3px', backgroundColor: '#1a73e8', color: '#fff', borderRadius: 6, fontWeight: 700 }}>
                +{images.length - 1}
              </span>
            )}
          </span>
        )}
        <span className="truncate min-w-0 flex-1">{event.title}</span>

        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setInfoOpen(true); }}
            onContextMenu={(e) => e.stopPropagation()}
            title="Ver / editar detalhamento"
            className="w-3 h-3 flex items-center justify-center rounded bg-black/25 hover:bg-black/40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2 h-2">
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M3 6h.01" />
              <path d="M3 12h.01" />
              <path d="M3 18h.01" />
            </svg>
          </button>

          {onOpenHistory && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenHistory(event); }}
              onContextMenu={(e) => e.stopPropagation()}
              title="Histórico: quando foi colocado na agenda"
              className="w-3 h-3 flex items-center justify-center rounded bg-black/25 hover:bg-black/40"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2 h-2">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 10h18" />
                <path d="M9 4v16" />
              </svg>
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setAnchor(chipRef.current?.getBoundingClientRect() ?? null);
              setAssignOpen((v) => !v);
            }}
            onContextMenu={(e) => e.stopPropagation()}
            title="Atribuir projeto"
            className="w-3 h-3 flex items-center justify-center rounded bg-black/25 hover:bg-black/40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2 h-2">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
            </svg>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(event);
            }}
            onContextMenu={(e) => e.stopPropagation()}
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
              onContextMenu={(e) => e.stopPropagation()}
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

      {expanded && (
        <div style={{ marginTop: 2, fontSize: 10, lineHeight: 1.25 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            <span style={{ opacity: 0.9 }}>
              {formatMinutesLabel(startMin)} – {formatMinutesLabel(endMin)} · {formatDuration(durationMin)}
            </span>
            {totalMin > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleAddDetail(); }}
                onContextMenu={(e) => e.stopPropagation()}
                title="Adicionar detalhe"
                className="rounded bg-black/25 hover:bg-black/40"
                style={{ border: 'none', color: '#fff', cursor: 'pointer', fontSize: 10, lineHeight: '14px', padding: '0 5px', flexShrink: 0 }}
              >
                + detalhe
              </button>
            )}
          </div>
          {totalMin > 0 && (
            <div
              onMouseEnter={() => setDragLocked(true)}
              onMouseLeave={() => setDragLocked(false)}
              onDoubleClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.stopPropagation()}
              className="rounded bg-white text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
              style={{ marginTop: 3, padding: 4, cursor: 'default' }}
            >
              <EventDetailsTimeline
                mode="edit"
                details={details ?? []}
                durationMin={totalMin}
                pxPerMin={pxPerMin}
                eventStartMin={startMin}
                palette={palette}
                snap={snap}
                focusId={focusId}
                onCreate={add}
                onUpdate={update}
                onRemove={remove}
              />
            </div>
          )}
        </div>
      )}

      {assignOpen && anchor &&
        createPortal(
          <div
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            className="border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
            style={{
              position: 'fixed',
              left: Math.max(4, Math.min(anchor.left, window.innerWidth - 216)),
              ...(popoverBelow
                ? { top: anchor.bottom + 4 }
                : { bottom: window.innerHeight - anchor.top + 4 }),
              borderRadius: 6,
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              padding: 8,
              width: 200,
              zIndex: 70,
            }}
          >
            <ProjectSearchSelect
              value={event.project_id}
              onChange={(projectId) => { onProjectAssign(event.id, projectId); setAssignOpen(false); }}
            />
          </div>,
          document.body,
        )}

      <EventImageGalleryModal isOpen={galleryOpen} onClose={() => setGalleryOpen(false)} images={images} title={event.title} />

      {infoOpen &&
        createPortal(
          // portal no body: fora do chip arrastável (senão selecionar texto no popup arrastaria o chip).
          // Os stopPropagation impedem que cliques/duplo clique/botão direito do popup subam pelo
          // React até o chip (que abriria edição ou o painel de estatísticas).
          <div
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
          >
            <EventInfoPopup
              event={event}
              color={color}
              breadcrumb={breadcrumb}
              cover={displayImage}
              onClose={() => setInfoOpen(false)}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
