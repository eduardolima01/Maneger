import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Event } from '@/types/event.types';
import { fromLocalISO, toLocalISO, minutesSinceMidnight, snapMinutes, formatMinutesLabel, formatDuration, isSameDay } from '../lib/utils/date';
import EventImageGalleryModal from './components/EventImageGalleryModal';
import ContextMenu from '@/components/ui/ContextMenu';
import EventDetailsTimeline from './components/EventDetailsTimeline';
import { selectEvent, getActiveSelectedId, useSelectedEventId, registerEventBlock } from './eventSelection';
import { useEventDetails } from './hooks/useEventDetails';

/**
 * Decide texto claro ou escuro pra descrição, com base na luminância da cor
 * de fundo do evento — heurística simples (sem correção gama, não é um
 * cálculo de contraste WCAG estrito), só o suficiente pra não deixar texto
 * branco ilegível em cores de projeto claras (amarelo, verde-claro, etc).
 */
function getDescriptionColors(hex: string): { text: string; overlayBg: string; overlayBorder: string } {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) {
    return { text: '#fff', overlayBg: 'rgba(255,255,255,0.12)', overlayBorder: 'rgba(255,255,255,0.35)' };
  }
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const isLight = luminance > 0.6;
  return isLight
    ? { text: '#1a1a1a', overlayBg: 'rgba(0,0,0,0.12)', overlayBorder: 'rgba(0,0,0,0.25)' }
    : { text: '#fff', overlayBg: 'rgba(255,255,255,0.12)', overlayBorder: 'rgba(255,255,255,0.35)' };
}

/**
 * O bloco escuta atalhos globais enquanto está com o mouse em cima ('q'
 * apaga, toque em Control abre a edição). Quem está digitando num campo
 * (ex.: um sub-card de detalhamento) não pode disparar isso.
 */
// Atalhos de teclado W/S: passo fino, passo rápido (com Alt) e duração mínima ao mexer nas bordas.
const KEY_STEP_FINE = 5;
const KEY_STEP_FAST = 30;
const KEY_MIN_DURATION = 15;
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable;
}

/** Título em até 3 linhas (usado quando o bloco reserva a coluna da esquerda pra capa + título). */
const TITLE_CLAMP: React.CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
};

interface EventBlockProps {
  event: Event;
  onRequestDelete: (Event: Event) => void;
  hourHeight: number;
  color: string;
  images: string[];
  fallbackCover: string | null;
  breadcrumb: { name: string }[];
  days: Date[];
  dayIndex: number;
  getColumnWidth: () => number;
  segmentKind?: 'start' | 'continuation';
  overlapLevel?: number;
  onEditClick: (event: Event) => void;
  onProjectClick: (event: Event) => void;
  onDoubleClick: (event: Event) => void;
  onEventClick: (event: Event) => void;
  onChange: (id: string, startAt: string, endAt: string) => void;
  onDuplicate: (event: Event, startAt: string, endAt: string) => void;
  onProjectAssign: (eventId: string, projectId: string | null) => void;
  /** @deprecated não é mais usado — o detalhamento é salvo direto em event_details. Mantido opcional pra não quebrar quem ainda passa a prop. */
  onDescriptionChange?: (id: string, description: string) => void;
  /** O segundo argumento é a capa exibida no bloco, pra o popup mostrar a mesma. */
  onOpenInfoPopup: (event: Event, cover?: string | null) => void;
  /** Abre a tabela de histórico (quando o evento foi colocado na agenda). Sem a prop, o botão e o item de menu não aparecem. */
  onOpenHistory?: (event: Event) => void;
}

export default function EventBlock({
  event, hourHeight, color, images, fallbackCover, breadcrumb, days, dayIndex, getColumnWidth,
  overlapLevel = 0,
  segmentKind = 'start',
  onEditClick, onProjectClick, onDoubleClick, onEventClick, onChange, onDuplicate, onRequestDelete, onOpenInfoPopup, onOpenHistory,
}: EventBlockProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const displayImage = images[0] ?? fallbackCover;

  const start = fromLocalISO(event.start_at);
  const end = fromLocalISO(event.end_at);
  const startMin = minutesSinceMidnight(start);
  const spansMidnight = !isSameDay(start, end);

  const INSET_PX = 14;
  const leftInset = 2 + overlapLevel * INSET_PX;

  const visualStartMin = segmentKind === 'continuation' ? 0 : startMin;
  const visualDurationMin =
    segmentKind === 'continuation'
      ? Math.max(15, minutesSinceMidnight(end))
      : spansMidnight
        ? Math.max(15, 24 * 60 - startMin)
        : Math.max(15, minutesSinceMidnight(end) - startMin);

  const canMove = segmentKind === 'start';
  const canResizeBottom = segmentKind === 'continuation' || !spansMidnight;
  // Redimensionar pela borda de cima só faz sentido no segmento que contém
  // o início real do evento — o segmento de "continuação" começa em 00:00
  // e não tem um início próprio pra mover.
  const canResizeTop = segmentKind === 'start';

  const [dragOffsetMin, setDragOffsetMin] = useState(0);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [resizeExtraMin, setResizeExtraMin] = useState(0);
  const [resizeTopExtraMin, setResizeTopExtraMin] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  // Hover só na área dos detalhes (faixas à direita, ou o chip "≡ N" em blocos
  // sem espaço pra elas) — nunca no card inteiro, pra não cobrir os botões.
  const [hoverDetails, setHoverDetails] = useState(false);
  // Posição do painel em coordenadas da janela (ele é renderizado no body).
  const [popoverPos, setPopoverPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const dragMode = useRef<'move' | 'resize' | 'resize-top' | null>(null);
  const dragStartY = useRef(0);
  const dragStartX = useRef(0);
  const blockRef = useRef<HTMLDivElement>(null);


  const isDraggingActive = dragOffsetMin !== 0 || dragOffsetX !== 0 || resizeExtraMin !== 0 || resizeTopExtraMin !== 0;

  const ctrlOnlyRef = useRef(true); // reseta a cada novo "hold" de Control, igual ao toggle do MarkdownField

  // R/F movem o evento SELECIONADO (R sobe, F desce; clique no card; Esc ou clique fora desmarcam). W/A/S/D só navegam entre cards.
  // Sem seleção, vale o card sob o mouse — e ele passa a ficar selecionado.
  const selectedId = useSelectedEventId();
  const isSelected = selectedId === event.id;
  const [showTimeHint, setShowTimeHint] = useState(false);
  const hintTimer = useRef<number | undefined>(undefined);
  const pendingRef = useRef<{ start: Date; end: Date } | null>(null);
  // o evento mudou (nosso próprio onChange voltou pelas props): descarta o valor "em trânsito"
  useEffect(() => { pendingRef.current = null; }, [event.start_at, event.end_at]);
  useEffect(() => registerEventBlock(event.id), [event.id]);
  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  useEffect(() => {
    if ((!isHovering && !isSelected) || isDraggingActive) return;

    function applyKeyboardChange(kind: 'move' | 'top' | 'bottom', delta: number): boolean {
      const base = pendingRef.current ?? { start, end };
      const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);
      const dayStart = new Date(base.start);
      dayStart.setHours(0, 0, 0, 0);
      const dayLimit = addMin(dayStart, 24 * 60 - KEY_STEP_FINE); // fica no dia (até 23:55), como o arrastar
      let ns = base.start;
      let ne = base.end;

      if (kind === 'move') {
        ns = addMin(ns, delta);
        ne = addMin(ne, delta);
        if (ns < dayStart) {
          const fix = dayStart.getTime() - ns.getTime();
          ns = new Date(ns.getTime() + fix);
          ne = new Date(ne.getTime() + fix);
        } else if (!spansMidnight && ne > dayLimit) {
          const fix = ne.getTime() - dayLimit.getTime();
          ns = new Date(ns.getTime() - fix);
          ne = new Date(ne.getTime() - fix);
        }
      } else if (kind === 'top') {
        ns = addMin(ns, delta);
        if (ns < dayStart) ns = dayStart;
        const latest = addMin(ne, -KEY_MIN_DURATION);
        if (ns > latest) ns = latest;
      } else {
        ne = addMin(ne, delta);
        const earliest = addMin(ns, KEY_MIN_DURATION);
        if (ne < earliest) ne = earliest;
        if (!spansMidnight && ne > dayLimit) ne = dayLimit;
      }

      if (ns.getTime() === base.start.getTime() && ne.getTime() === base.end.getTime()) return false;
      pendingRef.current = { start: ns, end: ne };
      onChange(event.id, toLocalISO(ns), toLocalISO(ne));
      return true;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (isHovering && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        onRequestDelete(event);
        return;
      }

      if (e.key === 'Control') { ctrlOnlyRef.current = true; return; }
      if (e.ctrlKey) ctrlOnlyRef.current = false; // combo (Ctrl+C, Ctrl+V...) cancela o toque puro

      // R/F: mover (R sobe, F desce). Shift: só uma borda (R = de cima, F = de baixo; Ctrl inverte: encolhe). Alt: passo maior.
      if ((e.code === 'KeyR' || e.code === 'KeyF') && !e.metaKey) {
        if (e.ctrlKey && !e.shiftKey) return; // Ctrl+R / Ctrl+F sozinhos são do navegador (recarregar / buscar)
        // com um card selecionado na tela, só ele reage; sem seleção, o que está sob o mouse
        const active = getActiveSelectedId();
        const mine = active !== null ? active === event.id : isHovering;
        if (!mine) return;

        const up = e.code === 'KeyR';
        const base = pendingRef.current ?? { start, end };
        const durNow = Math.round((base.end.getTime() - base.start.getTime()) / 60000);
        const step = e.altKey ? KEY_STEP_FAST : durNow <= 15 ? 1 : KEY_STEP_FINE;

        let kind: 'move' | 'top' | 'bottom';
        let delta: number;
        if (!e.shiftKey) {
          if (!canMove) return;
          kind = 'move';
          delta = up ? -step : step;
        } else if (up) {
          if (!canResizeTop) return;
          kind = 'top';
          delta = e.ctrlKey ? step : -step; // para cima aumenta; com Ctrl encolhe por cima
        } else {
          if (!canResizeBottom) return;
          kind = 'bottom';
          delta = e.ctrlKey ? -step : step; // para baixo aumenta; com Ctrl encolhe por baixo
        }

        e.preventDefault();
        applyKeyboardChange(kind, delta);
        selectEvent(event.id);
        // mostra o horário por um instante (o mouse pode estar longe do card)
        setShowTimeHint(true);
        window.clearTimeout(hintTimer.current);
        hintTimer.current = window.setTimeout(() => setShowTimeHint(false), 1500);
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (isHovering && e.key === 'Control' && ctrlOnlyRef.current) {
        onEditClick(event);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHovering, isSelected, isDraggingActive, event, segmentKind, onRequestDelete, onEditClick, onChange]);

  const pxPerMin = hourHeight / 60;

  function beginDrag(mode: 'move' | 'resize' | 'resize-top', e: React.PointerEvent) {
    if (mode === 'move' && !canMove) return;
    if (mode === 'resize' && !canResizeBottom) return;
    if (mode === 'resize-top' && !canResizeTop) return;

    e.stopPropagation();
    selectEvent(event.id);
    dragMode.current = mode;
    dragStartY.current = e.clientY;
    dragStartX.current = e.clientX;
    setDragOffsetMin(0);
    setDragOffsetX(0);
    setResizeExtraMin(0);
    setResizeTopExtraMin(0);

    const columnWidth = getColumnWidth();
    const durationMin = visualDurationMin;

    const handleMove = (ev: PointerEvent) => {
      const deltaMin = snapMinutes((ev.clientY - dragStartY.current) / pxPerMin);
      if (dragMode.current === 'move') {
        setDragOffsetMin(deltaMin);
        setDragOffsetX(ev.clientX - dragStartX.current);
      }
      if (dragMode.current === 'resize') setResizeExtraMin(Math.max(15 - durationMin, deltaMin));
      if (dragMode.current === 'resize-top') {
        setResizeTopExtraMin(Math.min(durationMin - 15, Math.max(-startMin, deltaMin)));
      }
    };

    const handleUp = (ev: PointerEvent) => {
      const deltaMin = snapMinutes((ev.clientY - dragStartY.current) / pxPerMin);
      const deltaX = ev.clientX - dragStartX.current;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);

      const isPlainClick =
        Math.abs(ev.clientY - dragStartY.current) < 5 &&
        Math.abs(deltaX) < 5;

      if (dragMode.current === 'move' && isPlainClick) {
        // clique simples sem arrastar: não faz nada (menu abre no botão direito)
      } else if (dragMode.current === 'move' && canMove && (deltaMin !== 0 || Math.abs(deltaX) >= columnWidth / 2)) {
        const dayDelta = columnWidth > 0 ? Math.round(deltaX / columnWidth) : 0;
        const targetDayIndex = Math.min(days.length - 1, Math.max(0, dayIndex + dayDelta));
        const targetDay = days[targetDayIndex];

        const eventDurationMin = minutesSinceMidnight(end) - startMin + (spansMidnight ? 24 * 60 : 0);
        const newStart = new Date(targetDay);
        newStart.setHours(0, startMin + deltaMin, 0, 0);
        const newEnd = new Date(newStart.getTime() + eventDurationMin * 60000);

        if (ev.altKey) {
          onDuplicate(event, toLocalISO(newStart), toLocalISO(newEnd));
        } else {
          onChange(event.id, toLocalISO(newStart), toLocalISO(newEnd));
        }
      } else if (dragMode.current === 'resize' && canResizeBottom && deltaMin !== 0) {
        const extra = Math.max(15 - durationMin, deltaMin);
        const newEnd = new Date(end.getTime() + extra * 60000);
        onChange(event.id, event.start_at, toLocalISO(newEnd));
      } else if (dragMode.current === 'resize-top' && canResizeTop && deltaMin !== 0) {
        const extra = Math.min(durationMin - 15, Math.max(-startMin, deltaMin));
        const newStart = new Date(start.getTime() + extra * 60000);
        onChange(event.id, toLocalISO(newStart), event.end_at);
      }

      dragMode.current = null;
      setDragOffsetMin(0);
      setDragOffsetX(0);
      setResizeExtraMin(0);
      setResizeTopExtraMin(0);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  const top = (visualStartMin + dragOffsetMin + resizeTopExtraMin) * pxPerMin;
  // 22px é o mínimo pra uma linha de texto de 12px com um pouquinho de
  // respiro não ficar cortada — 16px (valor antigo) espremia o título e,
  // com a miniatura de imagem, ficava ilegível em eventos de 15min.
  const MIN_BLOCK_HEIGHT = 22;
  const height = Math.max(MIN_BLOCK_HEIGHT, (visualDurationMin + resizeExtraMin - resizeTopExtraMin) * pxPerMin);
  const isVeryShort = height < 30;
  // Os detalhes são carregados em todo segmento inicial (é leitura em memória,
  // barata) porque alimentam o tooltip do hover, que funciona em bloco de
  // qualquer tamanho. A linha do tempo dentro do bloco só aparece quando ele
  // não atravessa a meia-noite (senão a escala do bloco não cobre o evento
  // inteiro) e tem pelo menos 44px. Em ambos os casos é só leitura: pra editar,
  // use o botão de detalhamento do bloco (ou botão direito → "Ver / editar detalhamento").
  const { details } = useEventDetails(event.id, segmentKind === 'start');
  const canShowTimeline = segmentKind === 'start' && !spansMidnight && height >= 44;
  const splitLayout = canShowTimeline && details.length > 0;
  const descriptionColors = getDescriptionColors(color);
  const thumbSize = Math.max(14, Math.min(height - 8, 40)); // cresce com a altura do evento; fica pequeno (ícone) em eventos curtos

  const isDraggingMove = dragOffsetMin !== 0 || dragOffsetX !== 0;
  const isResizing = resizeExtraMin !== 0;
  const isResizingTop = resizeTopExtraMin !== 0;
  const showHoverTooltip = (isHovering || showTimeHint) && !hoverDetails && !isDraggingMove && !isResizing && !isResizingTop;
  const showDetailsPopover = hoverDetails && details.length > 0 && !isDraggingMove && !isResizing && !isResizingTop;

  function handleDetailsEnter() {
    // Abre pra baixo do card; se não couber na tela, abre pra cima. Em
    // coordenadas da janela porque o painel vai pro body (ver showDetailsPopover).
    const rect = blockRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.max(4, Math.min(rect.left, window.innerWidth - 290));
      const above = rect.bottom + Math.min(details.length, 8) * 14 + 30 > window.innerHeight;
      setPopoverPos(
        above ? { left, bottom: window.innerHeight - rect.top + 3 } : { left, top: rect.bottom + 3 }
      );
    }
    setHoverDetails(true);
  }
  const fullPath = breadcrumb.map((p) => p.name).join(' / ');
  const assignedName = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].name : null;

  const previewStartMin = visualStartMin + dragOffsetMin;
  const previewEndMin = previewStartMin + visualDurationMin;
  const previewResizeEndMin = visualStartMin + visualDurationMin + resizeExtraMin;
  const previewResizeTopStartMin = visualStartMin + resizeTopExtraMin;

  return (
    <div
      ref={blockRef}
      data-event-block="true"
      data-event-id={event.id}
      data-segment={segmentKind}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        selectEvent(event.id);
        if (canMove) beginDrag('move', e);
      }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenuPos({ x: e.clientX, y: e.clientY }); }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(event); }}
      className="group"
      style={{
        position: 'absolute',
        top,
        height,
        left: leftInset,
        right: 2,
        backgroundColor: color,
        color: '#fff',
        borderRadius: 4,
        borderTop: segmentKind === 'continuation' ? '2px dashed rgba(255,255,255,0.7)' : undefined,
        borderBottom: segmentKind === 'start' && spansMidnight ? '2px dashed rgba(255,255,255,0.7)' : undefined,
        outline: isSelected ? '2px solid #1a73e8' : overlapLevel > 0 ? '2px solid #fff' : undefined,
        outlineOffset: isSelected ? 1 : undefined,
        padding: isVeryShort ? '1px 6px' : '2px 6px',
        fontSize: 12,
        lineHeight: isVeryShort ? '1.1' : undefined,
        cursor: canMove ? 'pointer' : 'default',
        userSelect: 'none',
        zIndex: 2 + overlapLevel,
        transform: dragOffsetX ? `translateX(${dragOffsetX}px)` : undefined,
        boxShadow: dragOffsetX ? '0 4px 12px rgba(0,0,0,0.3)' : undefined,
      }}
    >
      {canResizeTop && (
        <div
          onPointerDown={(e) => e.button === 0 && beginDrag('resize-top', e)}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 6, cursor: 'ns-resize', zIndex: 3 }}
        />
      )}

      {segmentKind === 'continuation' && (
        <span style={{ position: 'absolute', top: -14, left: 2, fontSize: 10, opacity: 0.85 }} title="Continua do dia anterior">⤴</span>
      )}
      {segmentKind === 'start' && spansMidnight && (
        <span style={{ position: 'absolute', bottom: -14, right: 2, fontSize: 10, opacity: 0.85 }} title="Continua no dia seguinte">⤵</span>
      )}

      {showHoverTooltip && (
        <div style={{ position: 'absolute', top: -22, left: 0, width: 'max-content', backgroundColor: '#333', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none' }}>
          <div>{formatMinutesLabel(minutesSinceMidnight(start))} – {formatMinutesLabel(minutesSinceMidnight(start) + (minutesSinceMidnight(end) - minutesSinceMidnight(start) + (spansMidnight ? 24 * 60 : 0)))} · {formatDuration(minutesSinceMidnight(end) - minutesSinceMidnight(start) + (spansMidnight ? 24 * 60 : 0))}</div>
          {fullPath && <div style={{ opacity: 0.8, fontSize: 10 }}>📁 {fullPath}</div>}
        </div>
      )}

      {showDetailsPopover && popoverPos &&
        createPortal(
          // No body, fora da grade: assim nenhum card vizinho (nem o overflow
          // da coluna) fica por cima ou corta o painel.
          <div
            style={{
              position: 'fixed', left: popoverPos.left, top: popoverPos.top, bottom: popoverPos.bottom,
              width: 'max-content', maxWidth: 280, backgroundColor: '#333', color: '#fff',
              fontSize: 10, lineHeight: 1.35, padding: '5px 8px', borderRadius: 4, zIndex: 9999,
              pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            {details.slice(0, 8).map((d) => (
              <div key={d.id}>
                <span style={{ opacity: 0.75 }}>
                  {formatMinutesLabel((startMin + (d.start_offset ?? 0)) % 1440)}–{formatMinutesLabel((startMin + (d.end_offset ?? 0)) % 1440)}
                </span>{' '}
                {d.content || '—'}
              </div>
            ))}
            {details.length > 8 && <div style={{ opacity: 0.7 }}>+{details.length - 8} mais…</div>}
          </div>,
          document.body
        )}

      {!splitLayout && details.length > 0 && (
        <span
          onMouseEnter={handleDetailsEnter}
          onMouseLeave={() => setHoverDetails(false)}
          style={{
            position: 'absolute', left: 3, bottom: 2, zIndex: 4, fontSize: 9, lineHeight: '12px',
            padding: '0 4px', borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff',
          }}
        >
          ≡ {details.length}
        </span>
      )}

      {isDraggingMove && (
        <div style={{ position: 'absolute', top: -22, left: 0, backgroundColor: '#333', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none' }}>
          {formatMinutesLabel(previewStartMin)} – {formatMinutesLabel(previewEndMin)}
        </div>
      )}

      {isResizing && (
        <div style={{ position: 'absolute', bottom: -22, left: 0, backgroundColor: '#333', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none' }}>
          até {formatMinutesLabel(previewResizeEndMin)}
        </div>
      )}

      {isResizingTop && (
        <div style={{ position: 'absolute', top: -22, left: 0, backgroundColor: '#333', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none' }}>
          desde {formatMinutesLabel(previewResizeTopStartMin)}
        </div>
      )}

      <div style={splitLayout ? { width: '40%', overflow: 'hidden', position: 'relative', zIndex: 1 } : undefined}>
        <span
          className={splitLayout ? 'flex gap-1' : 'truncate flex items-center gap-1 pr-10'}
          style={splitLayout ? { flexDirection: 'column', alignItems: 'flex-start' } : undefined}
        >
          {displayImage && !isVeryShort && (!splitLayout || height >= 80) && (
            <span
              onClick={(e) => { e.stopPropagation(); if (images.length > 0) setGalleryOpen(true); }}
              onPointerDown={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.stopPropagation()}
              style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, cursor: images.length > 0 ? 'zoom-in' : 'default' }}
            >
              <img src={convertFileSrc(displayImage)} style={{ width: thumbSize, height: thumbSize, borderRadius: 4, objectFit: 'cover' }} />
              {images.length > 1 && (
                <span style={{ position: 'absolute', bottom: -3, right: -3, fontSize: 9, lineHeight: '12px', padding: '0 3px', backgroundColor: '#1a73e8', color: '#fff', borderRadius: 7, fontWeight: 700 }}>
                  +{images.length - 1}
                </span>
              )}
            </span>
          )}
          <span className={splitLayout ? undefined : 'truncate'} style={splitLayout ? TITLE_CLAMP : undefined}>{event.title}</span>
        </span>

        {assignedName && (
          <span className="flex items-center gap-1 text-[10px] opacity-90 truncate">
            <span className="truncate">{assignedName}</span>
          </span>
        )}

        {height >= 36 && (
          <span className="block text-[10px] opacity-80 truncate">
            {formatDuration(minutesSinceMidnight(end) - minutesSinceMidnight(start) + (spansMidnight ? 24 * 60 : 0))}
          </span>
        )}
        {height >= 65 && fullPath.includes(' / ') && (
          <span className="block text-[10px] opacity-70 truncate">📁 {fullPath}</span>
        )}

      </div>

      {splitLayout && (
        <div
          onMouseEnter={handleDetailsEnter}
          onMouseLeave={() => setHoverDetails(false)}
          style={{ position: 'absolute', top: 0, bottom: 0, left: '40%', right: 0, overflow: 'hidden' }}
        >
          {/* Mesma escala do bloco (px por minuto da grade); ao redimensionar pela
              borda de cima, a linha do tempo fica ancorada no horário real. */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: -resizeTopExtraMin * pxPerMin, height: visualDurationMin * pxPerMin }}>
            <EventDetailsTimeline
              mode="view"
              details={details}
              durationMin={visualDurationMin}
              pxPerMin={pxPerMin}
              eventStartMin={startMin}
              palette={{
                text: descriptionColors.text,
                cardBg: descriptionColors.overlayBg,
                border: descriptionColors.overlayBorder,
              }}
            />
          </div>
        </div>
      )}

      <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onEditClick(event); }}
          title="Editar evento"
          className="w-4 h-4 flex items-center justify-center rounded bg-black/25 hover:bg-black/40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2.5 h-2.5">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>

        <button
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onOpenInfoPopup(event, displayImage); }}
          title={details.length > 0 ? `Detalhamento (${details.length})` : 'Detalhamento do evento'}
          className="w-4 h-4 flex items-center justify-center rounded bg-black/25 hover:bg-black/40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2.5 h-2.5">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </button>

        {onOpenHistory && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onOpenHistory(event); }}
            title="Histórico: quando foi colocado na agenda"
            className="w-4 h-4 flex items-center justify-center rounded bg-black/25 hover:bg-black/40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2.5 h-2.5">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 10h18" />
              <path d="M9 4v16" />
            </svg>
          </button>
        )}

        {event.project_id && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onProjectClick(event); }}
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

      {canResizeBottom && (
        <div
          onPointerDown={(e) => e.button === 0 && beginDrag('resize', e)}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, cursor: 'ns-resize', zIndex: 3 }}
        />
      )}


      <EventImageGalleryModal isOpen={galleryOpen} onClose={() => setGalleryOpen(false)} images={images} title={event.title} />

      {contextMenuPos && (
        <ContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          onClose={() => setContextMenuPos(null)}
          items={[
            { label: 'Resumo de tempo do projeto', onClick: () => onEventClick(event) },
            { label: 'Ver / editar detalhamento', onClick: () => onOpenInfoPopup(event, displayImage) },
            ...(onOpenHistory ? [{ label: 'Histórico na agenda (tabela)', onClick: () => onOpenHistory(event) }] : []),
          ]}
        />
      )}
    </div>
  );
}
