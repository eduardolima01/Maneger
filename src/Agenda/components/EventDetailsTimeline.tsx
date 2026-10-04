import { useEffect, useMemo, useRef, useState } from 'react';
import type { EventDetail } from '@/types/event.types';
import { formatMinutesLabel, formatDuration } from '@/lib/utils/date';
import type { EventDetailPatch } from '../api/eventDetails';

export interface DetailsPalette {
  text: string;
  cardBg: string;
  border: string;
}

/** Texto claro ou escuro conforme a luminância da cor (mesma heurística do EventBlock). */
export function contrastText(hex: string): '#fff' | '#1a1a1a' {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#fff';
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#1a1a1a' : '#fff';
}

/** Próximo trecho livre pro botão "+ detalhe": logo depois do último detalhe existente. */
export function suggestSlot(details: EventDetail[], durationMin: number, length = 15) {
  const len = Math.max(1, Math.min(length, durationMin));
  const lastEnd = details.reduce((max, d) => Math.max(max, d.end_offset ?? 0), 0);
  const start = lastEnd + len <= durationMin ? lastEnd : Math.max(0, durationMin - len);
  return { start, end: start + len };
}

interface EventDetailsTimelineProps {
  /** edit = arrasta/redimensiona/edita (popup); view = só mostra, proporcional (bloco da agenda). */
  mode: 'edit' | 'view';
  details: EventDetail[];
  /** Duração total do evento: a linha do tempo vai de 0 a este valor. */
  durationMin: number;
  pxPerMin: number;
  /** Minutos desde a meia-noite em que o evento começa — só pra rotular horários. */
  eventStartMin: number;
  palette: DetailsPalette;
  /** Granularidade do arrastar, em minutos (modo edit). */
  snap?: number;
  onCreate?: (startOffset: number, endOffset: number) => Promise<string | null>;
  onUpdate?: (id: string, patch: EventDetailPatch) => void;
  onRemove?: (id: string) => void;
  /** Detalhe recém-criado por fora (botão "+ detalhe") que deve abrir já em edição de texto. */
  focusId?: string | null;
}

const TICK_STEPS = [1, 5, 10, 15, 30, 60, 120, 180, 360];
const GUTTER = 46;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

interface Laid {
  id: string;
  s: number;
  e: number;
  lane: number;
  lanes: number;
}

/**
 * Coloca detalhes que se sobrepõem lado a lado (mesma ideia das colunas de
 * eventos sobrepostos da agenda): dentro de cada grupo que se sobrepõe, cada
 * detalhe ocupa a primeira "raia" livre e todos dividem a largura.
 */
function layoutLanes(items: { id: string; s: number; e: number }[]): Map<string, Laid> {
  const sorted = [...items].sort((a, b) => a.s - b.s || a.e - b.e);
  const out = new Map<string, Laid>();
  let cluster: { item: { id: string; s: number; e: number }; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const c of cluster) out.set(c.item.id, { ...c.item, lane: c.lane, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    if (cluster.length > 0 && item.s >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.s);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.e);
    } else {
      laneEnds[lane] = item.e;
    }
    cluster.push({ item, lane });
    clusterEnd = Math.max(clusterEnd, item.e);
  }
  flush();
  return out;
}

export default function EventDetailsTimeline({
  mode, details, durationMin, pxPerMin, eventStartMin, palette, snap = 5, onCreate, onUpdate, onRemove, focusId,
}: EventDetailsTimelineProps) {
  const editable = mode === 'edit';
  const trackRef = useRef<HTMLDivElement>(null);

  const [drag, setDrag] = useState<{ id: string; s: number; e: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Fantasma que segue o mouse num horário vazio ("clique pra criar aqui").
  const [hoverMin, setHoverMin] = useState<number | null>(null);
  // Trecho sendo desenhado ao arrastar num espaço vazio.
  const [creating, setCreating] = useState<{ s: number; e: number } | null>(null);
  // Detalhes recém-criados → último texto confirmado. Se o usuário sair da
  // edição sem escrever nada (ou apertar Esc), o card vazio é removido em
  // vez de ficar sobrando por um clique acidental.
  const freshRef = useRef(new Map<string, string>());
  // Valores otimistas: entre soltar o card e o store recarregar, mostra o novo
  // valor em vez de piscar o antigo. Limpa quando a lista de detalhes muda.
  const [overrides, setOverrides] = useState<Record<string, { s?: number; e?: number; content?: string }>>({});

  useEffect(() => setOverrides({}), [details]);
  useEffect(() => {
    if (focusId) {
      freshRef.current.set(focusId, '');
      setEditingId(focusId);
    }
  }, [focusId]);

  const clock = (offset: number) => formatMinutesLabel((((eventStartMin + offset) % 1440) + 1440) % 1440);

  const items = useMemo(
    () =>
      details.map((d) => {
        const o = overrides[d.id];
        const s = clamp(o?.s ?? d.start_offset ?? 0, 0, Math.max(0, durationMin - 1));
        const e = clamp(o?.e ?? d.end_offset ?? durationMin, s + 1, durationMin);
        return { id: d.id, s, e, content: o?.content ?? d.content };
      }),
    [details, overrides, durationMin]
  );
  const lanes = useMemo(() => layoutLanes(items), [items]);

  const tickStep = TICK_STEPS.find((step) => step * pxPerMin >= 32) ?? 360;
  const ticks: number[] = [];
  for (let t = 0; t <= durationMin; t += tickStep) ticks.push(t);
  if (durationMin - ticks[ticks.length - 1] >= tickStep / 2) ticks.push(durationMin);

  function beginDrag(ev: React.PointerEvent, item: { id: string; s: number; e: number }, dragMode: 'move' | 'top' | 'bottom') {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    ev.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur?.();

    const startY = ev.clientY;
    const len = item.e - item.s;

    const compute = (clientY: number) => {
      const delta = Math.round((clientY - startY) / pxPerMin / snap) * snap;
      if (dragMode === 'move') {
        const s = clamp(item.s + delta, 0, Math.max(0, durationMin - len));
        return { s, e: s + len };
      }
      if (dragMode === 'top') {
        return { s: clamp(item.s + delta, 0, item.e - snap), e: item.e };
      }
      return { s: item.s, e: clamp(item.e + delta, item.s + snap, durationMin) };
    };

    setDrag({ id: item.id, s: item.s, e: item.e });

    const handleMove = (m: PointerEvent) => setDrag({ id: item.id, ...compute(m.clientY) });
    const handleUp = (m: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      const final = compute(m.clientY);
      setDrag(null);
      // Clique sem arrastar num card = editar o texto dele.
      if (dragMode === 'move' && Math.abs(m.clientY - startY) < 4) {
        setEditingId(item.id);
        return;
      }
      if (final.s !== item.s || final.e !== item.e) {
        setOverrides((prev) => ({ ...prev, [item.id]: { ...prev[item.id], s: final.s, e: final.e } }));
        onUpdate?.(item.id, { start_offset: final.s, end_offset: final.e });
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  const slotAt = (clientY: number, trackTop: number) =>
    clamp(Math.floor((clientY - trackTop) / pxPerMin / snap) * snap, 0, Math.max(0, durationMin - 1));

  /**
   * Criar como na agenda: clicar num horário vazio cria um detalhe de 15 min
   * ali; arrastar desenha o trecho (pra baixo ou pra cima). Fica sempre
   * dentro de 0..duração do evento. Só reage a cliques no fundo da trilha,
   * nunca em cima de um card.
   */
  function beginCreate(ev: React.PointerEvent<HTMLDivElement>) {
    if (!editable || !onCreate || durationMin <= 0 || ev.button !== 0) return;
    if (ev.target !== ev.currentTarget) return;
    ev.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur?.();

    const top = ev.currentTarget.getBoundingClientRect().top;
    const startY = ev.clientY;
    const anchor = slotAt(startY, top);

    const rangeFor = (clientY: number) => {
      if (Math.abs(clientY - startY) < 4) {
        return { s: anchor, e: Math.min(durationMin, anchor + Math.max(snap, 15)) };
      }
      const cur = slotAt(clientY, top);
      const lo = Math.min(anchor, cur);
      const hi = Math.min(durationMin, Math.max(anchor, cur) + snap);
      return { s: lo, e: Math.max(hi, lo + 1) };
    };

    setHoverMin(null);
    setCreating(rangeFor(startY));

    const handleMove = (m: PointerEvent) => setCreating(rangeFor(m.clientY));
    const handleUp = async (m: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      const range = rangeFor(m.clientY);
      setCreating(null);
      const id = await onCreate(range.s, range.e);
      if (id) {
        freshRef.current.set(id, '');
        setEditingId(id);
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  function handleTrackPointerMove(ev: React.PointerEvent<HTMLDivElement>) {
    if (!editable || creating || drag) return;
    if (ev.target !== ev.currentTarget) {
      setHoverMin(null);
      return;
    }
    setHoverMin(slotAt(ev.clientY, ev.currentTarget.getBoundingClientRect().top));
  }

  function stopEditing(id: string) {
    setEditingId((cur) => (cur === id ? null : cur));
    const committed = freshRef.current.get(id);
    if (committed !== undefined) {
      freshRef.current.delete(id);
      if (committed.trim() === '') onRemove?.(id);
    }
  }

  function commitText(id: string, current: string, next: string) {
    if (freshRef.current.has(id)) freshRef.current.set(id, next);
    if (next === current) return;
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], content: next } }));
    onUpdate?.(id, { content: next });
  }

  const trackHeight = durationMin * pxPerMin;
  const gutter = editable ? GUTTER : 0;

  return (
    <div style={{ padding: editable ? '8px 0' : 0 }}>
      <div style={{ position: 'relative', height: trackHeight }}>
        {editable &&
          ticks.map((t) => (
            <div key={t}>
              <div
                className="border-t border-neutral-200 dark:border-neutral-700"
                style={{ position: 'absolute', top: t * pxPerMin, left: gutter - 4, right: 0 }}
              />
              <div
                className="text-neutral-500 dark:text-neutral-400"
                style={{
                  position: 'absolute', top: t * pxPerMin - 7, left: 0, width: gutter - 8,
                  textAlign: 'right', fontSize: 10, lineHeight: '14px', userSelect: 'none',
                }}
              >
                {clock(t)}
              </div>
            </div>
          ))}

        <div
          ref={trackRef}
          className={editable ? 'bg-black/[0.02] dark:bg-white/[0.04]' : undefined}
          onPointerDown={beginCreate}
          onPointerMove={handleTrackPointerMove}
          onPointerLeave={() => setHoverMin(null)}
          style={{
            position: 'absolute', top: 0, bottom: 0, left: gutter, right: 0,
            borderRadius: 4,
            cursor: editable ? 'cell' : undefined,
            touchAction: editable ? 'none' : undefined,
          }}
        >
          {editable && hoverMin !== null && !creating && !drag && (
            <div
              className="border border-dashed border-neutral-400 bg-black/[0.04] text-neutral-500 dark:border-neutral-500 dark:bg-white/[0.06] dark:text-neutral-400"
              style={{
                position: 'absolute', left: 1, right: 1, top: hoverMin * pxPerMin,
                height: Math.max(16, Math.min(15, durationMin - hoverMin) * pxPerMin - 1),
                borderRadius: 5, fontSize: 11, padding: '1px 6px', boxSizing: 'border-box',
                pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden',
              }}
            >
              + {clock(hoverMin)}
            </div>
          )}
          {creating && (
            <div
              style={{
                position: 'absolute', left: 1, right: 1, top: creating.s * pxPerMin,
                height: Math.max(16, (creating.e - creating.s) * pxPerMin - 1),
                border: `1px dashed ${palette.border}`, borderRadius: 5, backgroundColor: palette.cardBg,
                color: palette.text, opacity: 0.75, fontSize: 11, padding: '1px 6px', boxSizing: 'border-box',
                pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', zIndex: 7,
              }}
            >
              {clock(creating.s)}–{clock(creating.e)} · {formatDuration(creating.e - creating.s)}
            </div>
          )}
          {items.map((it) => {
            const laid = lanes.get(it.id);
            const live = drag && drag.id === it.id ? drag : null;
            const s = live?.s ?? it.s;
            const e = live?.e ?? it.e;
            return (
              <DetailCard
                key={it.id}
                id={it.id}
                content={it.content}
                s={s}
                e={e}
                lane={laid?.lane ?? 0}
                lanes={laid?.lanes ?? 1}
                pxPerMin={pxPerMin}
                editable={editable}
                palette={palette}
                isDragging={live !== null}
                isEditing={editingId === it.id}
                clock={clock}
                onBeginDrag={(ev, m) => beginDrag(ev, { id: it.id, s: it.s, e: it.e }, m)}
                onStartEditing={() => setEditingId(it.id)}
                onStopEditing={() => stopEditing(it.id)}
                onCommitText={(text) => commitText(it.id, it.content, text)}
                onRemove={() => onRemove?.(it.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface DetailCardProps {
  id: string;
  content: string;
  s: number;
  e: number;
  lane: number;
  lanes: number;
  pxPerMin: number;
  editable: boolean;
  palette: DetailsPalette;
  isDragging: boolean;
  isEditing: boolean;
  clock: (offset: number) => string;
  onBeginDrag: (ev: React.PointerEvent, mode: 'move' | 'top' | 'bottom') => void;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onCommitText: (text: string) => void;
  onRemove: () => void;
}

function DetailCard({
  content, s, e, lane, lanes, pxPerMin, editable, palette, isDragging, isEditing, clock,
  onBeginDrag, onStartEditing, onStopEditing, onCommitText, onRemove,
}: DetailCardProps) {
  const [hover, setHover] = useState(false);
  const [draft, setDraft] = useState(content);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      setDraft(content);
      cancelRef.current = false;
    }
    // só ao entrar em edição: não sobrescrever o que está sendo digitado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const height = Math.max(editable ? 16 : 10, (e - s) * pxPerMin - 1);
  const fontSize = editable ? 12 : 10;
  const range = `${clock(s)}–${clock(e)}`;
  const showTimeRow = editable && height >= 34;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onPointerDown={editable && !isEditing ? (ev) => onBeginDrag(ev, 'move') : undefined}
      onDoubleClick={
        editable
          ? (ev) => {
            ev.stopPropagation();
            onStartEditing();
          }
          : undefined
      }
      title={editable ? undefined : `${range} · ${content || 'sem descrição'}`}
      style={{
        position: 'absolute',
        top: s * pxPerMin,
        height,
        minHeight: isEditing ? 56 : undefined,
        left: `calc(${(lane * 100) / lanes}% + 1px)`,
        width: `calc(${100 / lanes}% - 2px)`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: editable ? '2px 6px' : '0 3px',
        borderRadius: editable ? 5 : 3,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.cardBg,
        color: palette.text,
        fontSize,
        lineHeight: editable ? 1.25 : 1.1,
        cursor: editable ? (isDragging ? 'grabbing' : isEditing ? 'text' : 'grab') : 'inherit',
        userSelect: 'none',
        zIndex: isDragging || isEditing ? 6 : 1,
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.3)' : undefined,
      }}
    >
      {editable && !isEditing && (
        <>
          <div
            onPointerDown={(ev) => onBeginDrag(ev, 'top')}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 5, cursor: 'ns-resize' }}
          />
          <div
            onPointerDown={(ev) => onBeginDrag(ev, 'bottom')}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, cursor: 'ns-resize' }}
          />
        </>
      )}

      {showTimeRow && (
        <div style={{ fontSize: 10, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {range} · {formatDuration(e - s)}
        </div>
      )}

      {isEditing ? (
        <textarea
          autoFocus
          value={draft}
          placeholder="O que foi feito neste trecho…"
          onChange={(ev) => setDraft(ev.target.value)}
          onPointerDown={(ev) => ev.stopPropagation()}
          onBlur={() => {
            if (!cancelRef.current) onCommitText(draft);
            onStopEditing();
          }}
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') {
              ev.stopPropagation();
              cancelRef.current = true;
              ev.currentTarget.blur();
            } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
              ev.currentTarget.blur();
            }
          }}
          style={{
            display: 'block', width: '100%', height: Math.max(40, height - (showTimeRow ? 16 : 0)),
            resize: 'none', border: 'none', outline: 'none', background: 'transparent',
            color: 'inherit', fontSize, lineHeight: 1.25, fontFamily: 'inherit', padding: 0, userSelect: 'text',
          }}
        />
      ) : (
        <div
          style={{
            // modo view: quebra linha quando a faixa é alta o bastante; senão, uma linha com reticências
            whiteSpace: editable ? 'pre-wrap' : height >= 26 ? 'normal' : 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-word',
          }}
        >
          {content || (editable ? <span style={{ opacity: 0.6, fontStyle: 'italic' }}>clique para descrever</span> : <span style={{ opacity: 0.7 }}>{range}</span>)}
        </div>
      )}

      {editable && hover && !isDragging && !isEditing && (
        <button
          type="button"
          title="Remover detalhe"
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={(ev) => {
            ev.stopPropagation();
            onRemove();
          }}
          style={{
            position: 'absolute', top: 1, right: 2, border: 'none', borderRadius: 3, cursor: 'pointer',
            background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 12, lineHeight: '14px', width: 16, height: 16, padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
