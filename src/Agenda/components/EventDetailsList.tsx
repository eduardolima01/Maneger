import { useEffect, useRef, useState } from 'react';
import type { EventDetail } from '@/types/event.types';
import { useEventDetails } from '../hooks/useEventDetails';
import type { EventDetailPatch } from "@/Agenda/api/EventDetails";

export interface DetailsPalette {
  text: string;
  cardBg: string;
  border: string;
}

interface EventDetailsListProps {
  eventId: string;
  /** compact = dentro do bloco na grade; full = dentro do popup. */
  variant: 'compact' | 'full';
  palette: DetailsPalette;
  /** Se definido, a lista rola por dentro quando passar dessa altura. */
  maxHeight?: number;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * Lista de sub-cards ("o que foi feito em cada tempo") de um evento.
 * A reordenação usa pointer events em vez do HTML5 Drag and Drop, então
 * funciona mesmo com `dragDropEnabled: true` na config de janela do Tauri.
 */
export default function EventDetailsList({ eventId, variant, palette, maxHeight }: EventDetailsListProps) {
  const compact = variant === 'compact';
  const { details, add, update, remove, reorder } = useEventDetails(eventId);

  const [focusId, setFocusId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragDy, setDragDy] = useState(0);
  const [insertSlot, setInsertSlot] = useState(0);
  const cardEls = useRef(new Map<string, HTMLDivElement>());

  function registerEl(id: string, el: HTMLDivElement | null) {
    if (el) cardEls.current.set(id, el);
    else cardEls.current.delete(id);
  }

  function beginReorder(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const fromIndex = details.findIndex((d) => d.id === id);
    if (fromIndex < 0) return;
    const ids = details.map((d) => d.id);

    // Posições medidas uma vez no início: só o card arrastado se move (via
    // transform), então as demais caixas ficam estáveis durante o gesto.
    const rects = ids.map((cardId) => {
      const r = cardEls.current.get(cardId)?.getBoundingClientRect();
      return { top: r?.top ?? 0, bottom: r?.bottom ?? 0 };
    });
    const startY = e.clientY;

    // "slot" = posição de inserção entre os cards, de 0 (antes do primeiro) a n (depois do último).
    const slotAt = (y: number) => {
      for (let i = 0; i < rects.length; i++) {
        if (y < (rects[i].top + rects[i].bottom) / 2) return i;
      }
      return rects.length;
    };

    setDragId(id);
    setDragDy(0);
    setInsertSlot(fromIndex);

    const handleMove = (ev: PointerEvent) => {
      setDragDy(ev.clientY - startY);
      setInsertSlot(slotAt(ev.clientY));
    };

    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);

      const slot = slotAt(ev.clientY);
      const next = [...ids];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(slot > fromIndex ? slot - 1 : slot, 0, moved);
      if (next.some((v, i) => v !== ids[i])) reorder(next);

      setDragId(null);
      setDragDy(0);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  async function handleAdd() {
    const id = await add();
    if (id) setFocusId(id);
  }

  const dragFromIndex = dragId ? details.findIndex((d) => d.id === dragId) : -1;
  // Slot logo antes ou logo depois do próprio card = nada muda, não mostra a linha.
  const showLineAt = (slot: number) =>
    dragId !== null && insertSlot === slot && slot !== dragFromIndex && slot !== dragFromIndex + 1;

  const dropLine = (
    <div style={{ height: 2, borderRadius: 1, margin: '0 0 3px', backgroundColor: palette.text, opacity: 0.7 }} />
  );

  return (
    <div
      onPointerDown={stop}
      onClick={stop}
      onContextMenu={stop}
      onDoubleClick={stop}
      style={{
        marginTop: 4,
        maxHeight,
        overflowY: maxHeight ? 'auto' : undefined,
        color: palette.text,
        cursor: 'default',
      }}
    >
      {!compact && details.length === 0 && (
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
          Nenhum detalhe ainda. Adicione o que foi feito em cada momento do evento.
        </div>
      )}

      {details.map((d, i) => (
        <div key={d.id}>
          {showLineAt(i) && dropLine}
          <DetailCard
            detail={d}
            compact={compact}
            palette={palette}
            autoFocus={focusId === d.id}
            isDragging={dragId === d.id}
            dragDy={dragDy}
            registerEl={registerEl}
            onHandleDown={beginReorder}
            onUpdate={update}
            onRemove={remove}
          />
        </div>
      ))}
      {showLineAt(details.length) && dropLine}

      <button
        type="button"
        onClick={handleAdd}
        style={{
          border: `1px dashed ${palette.border}`,
          borderRadius: compact ? 4 : 6,
          background: 'transparent',
          color: 'inherit',
          opacity: 0.8,
          cursor: 'pointer',
          fontSize: compact ? 10 : 12,
          padding: compact ? '1px 6px' : '4px 10px',
          width: compact ? '100%' : undefined,
        }}
      >
        + detalhe
      </button>
    </div>
  );
}

interface DetailCardProps {
  detail: EventDetail;
  compact: boolean;
  palette: DetailsPalette;
  autoFocus: boolean;
  isDragging: boolean;
  dragDy: number;
  registerEl: (id: string, el: HTMLDivElement | null) => void;
  onHandleDown: (e: React.PointerEvent, id: string) => void;
  onUpdate: (id: string, patch: EventDetailPatch) => void;
  onRemove: (id: string) => void;
}

function DetailCard({
  detail, compact, palette, autoFocus, isDragging, dragDy, registerEl, onHandleDown, onUpdate, onRemove,
}: DetailCardProps) {
  const [content, setContent] = useState(detail.content);
  const [time, setTime] = useState(detail.time_label ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const draftRef = useRef({ content, time });
  draftRef.current = { content, time };
  const savedRef = useRef({ content: detail.content, time: detail.time_label ?? '' });
  const removedRef = useRef(false);

  // Sincroniza quando o valor do banco muda (ex.: editado na outra lista).
  useEffect(() => {
    setContent(detail.content);
    setTime(detail.time_label ?? '');
    savedRef.current = { content: detail.content, time: detail.time_label ?? '' };
  }, [detail.content, detail.time_label]);

  // Textarea cresce com o conteúdo, sem barra de rolagem própria.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  function commit() {
    if (removedRef.current) return;
    const d = draftRef.current;
    const s = savedRef.current;
    const trimmedTime = d.time.trim();
    const patch: EventDetailPatch = {};
    if (d.content !== s.content) patch.content = d.content;
    if (trimmedTime !== s.time) patch.time_label = trimmedTime === '' ? null : trimmedTime;
    if (patch.content !== undefined || patch.time_label !== undefined) {
      savedRef.current = { content: d.content, time: trimmedTime };
      onUpdate(detail.id, patch);
    }
  }

  // Salva no blur; e, se o card sumir da tela com edição pendente (popup
  // fechado no Esc, bloco que encolheu), grava o que estava no rascunho.
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => () => commitRef.current(), []);

  const fontSize = compact ? 10 : 13;

  return (
    <div
      ref={(el) => registerEl(detail.id, el)}
      style={{
        position: 'relative',
        zIndex: isDragging ? 5 : undefined,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 4,
        marginBottom: 4,
        padding: compact ? '2px 3px' : '6px 8px',
        border: `1px solid ${palette.border}`,
        borderRadius: compact ? 4 : 6,
        backgroundColor: palette.cardBg,
        color: palette.text,
        transform: isDragging ? `translateY(${dragDy}px)` : undefined,
        opacity: isDragging ? 0.85 : 1,
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.3)' : undefined,
      }}
    >
      <span
        onPointerDown={(e) => onHandleDown(e, detail.id)}
        title="Arrastar para reordenar"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
          opacity: 0.6,
          fontSize: compact ? 11 : 15,
          lineHeight: 1.2,
          flexShrink: 0,
        }}
      >
        ⠿
      </span>

      <input
        value={time}
        onChange={(e) => setTime(e.target.value)}
        onBlur={commit}
        placeholder="hora"
        title="Horário ou trecho do evento (opcional), ex.: 09:00–09:30"
        style={{
          width: compact ? 36 : 64,
          flexShrink: 0,
          border: 'none',
          borderBottom: `1px dashed ${palette.border}`,
          background: 'transparent',
          color: 'inherit',
          fontSize,
          fontFamily: 'inherit',
          padding: 0,
          outline: 'none',
          userSelect: 'text',
        }}
      />

      <textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        rows={1}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={commit}
        placeholder="O que foi feito…"
        style={{
          flex: 1,
          minWidth: 0,
          resize: 'none',
          overflow: 'hidden',
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          fontSize,
          lineHeight: 1.3,
          fontFamily: 'inherit',
          padding: 0,
          outline: 'none',
          userSelect: 'text',
        }}
      />

      <button
        type="button"
        onClick={() => {
          removedRef.current = true;
          onRemove(detail.id);
        }}
        title="Remover detalhe"
        style={{
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          opacity: 0.6,
          cursor: 'pointer',
          fontSize: compact ? 12 : 16,
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
