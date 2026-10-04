import { useEffect, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Event } from '@/types/event.types';
import { ProjectType } from '@/types/project.types';
import { fromLocalISO, minutesSinceMidnight, formatMinutesLabel, formatDuration, isSameDay } from '@/lib/utils/date';
import { useEventDetails } from '../hooks/useEventDetails';
import EventDetailsTimeline, { contrastText, suggestSlot } from './EventDetailsTimeline';

interface EventInfoPopupProps {
  event: Event | null;
  color: string;
  breadcrumb: ProjectType[];
  onClose: () => void;
  /** Capa do evento (caminho do arquivo). Opcional: sem ela, a coluna lateral mostra só o título. */
  cover?: string | null;
  /** @deprecated não é mais usado — o detalhamento é salvo direto no store da agenda. Mantido opcional pra não quebrar quem ainda passa a prop. */
  onDescriptionChange?: (id: string, description: string) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable);
}

/**
 * Popup do evento. Coluna da esquerda (na cor do projeto): capa, título,
 * horário e caminho. Coluna da direita: linha do tempo do detalhamento, com
 * a escala cobrindo exatamente o evento — arrastar pra mover, bordas pra
 * redimensionar e duplo clique pra criar/editar, como os eventos na agenda.
 */
export default function EventInfoPopup({ event, color, breadcrumb, onClose, cover }: EventInfoPopupProps) {
  const isOpen = event !== null;
  const { details, add, update, remove } = useEventDetails(event?.id ?? null, isOpen);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => setFocusId(null), [event?.id]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isTypingTarget(e.target)) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!event) return null;

  const start = fromLocalISO(event.start_at);
  const end = fromLocalISO(event.end_at);
  const sameDay = isSameDay(start, end);
  const durationMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const fullPath = breadcrumb.map((p) => p.name).join(' / ');

  // ~520px de altura pra eventos típicos: evento curto ganha escala grande,
  // evento longo rola. Limites evitam escala absurda nos extremos.
  const pxPerMin = Math.min(10, Math.max(1.6, 520 / Math.max(1, durationMin)));
  const snap = durationMin <= 15 ? 1 : 5;

  const asideText = '#fff';
  const palette = { text: contrastText(color), cardBg: color, border: 'rgba(0,0,0,0.3)' };

  async function handleAdd() {
    const slot = suggestSlot(details, durationMin);
    const id = await add(slot.start, slot.end);
    if (id) setFocusId(id);
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 50 }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="bg-white shadow-2xl dark:bg-neutral-900 dark:ring-1 dark:ring-white/10"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 760,
          maxWidth: '94vw',
          maxHeight: '88vh',
          display: 'flex',
          borderRadius: 8,
          zIndex: 51,
          overflow: 'hidden',
        }}
      >
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            backgroundColor: color,
            color: asideText,
            padding: 16,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {cover && (
            <img
              src={convertFileSrc(cover)}
              alt=""
              style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 6 }}
            />
          )}
          <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25, wordBreak: 'break-word' }}>{event.title}</div>
          <div style={{ fontSize: 12, opacity: 0.95 }}>
            {sameDay
              ? `${formatMinutesLabel(minutesSinceMidnight(start))} – ${formatMinutesLabel(minutesSinceMidnight(end))}`
              : `${start.toLocaleDateString('pt-BR')} ${formatMinutesLabel(minutesSinceMidnight(start))} → ${end.toLocaleDateString('pt-BR')} ${formatMinutesLabel(minutesSinceMidnight(end))}`}
            <div style={{ opacity: 0.85 }}>{formatDuration(durationMin)}</div>
          </div>
          {fullPath && <div style={{ fontSize: 11, opacity: 0.85 }}>📁 {fullPath}</div>}
        </aside>

        <section
          className="text-neutral-800 dark:text-neutral-200"
          style={{ flex: 1, minWidth: 0, padding: 16, overflowY: 'auto' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Detalhamento</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={handleAdd}
                disabled={durationMin <= 0}
                className="border border-neutral-300 bg-neutral-50 text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                style={{ borderRadius: 6, cursor: 'pointer', fontSize: 12, padding: '3px 10px' }}
              >
                + detalhe
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Fechar"
                className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          </div>
          <div className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, margin: '4px 0 6px' }}>
            Clique num horário para criar · arraste no vazio para definir o tempo · arraste um card para mover · bordas ajustam
          </div>

          {durationMin <= 0 ? (
            <div className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12, padding: '12px 0' }}>
              Este evento não tem duração, então não há o que detalhar.
            </div>
          ) : (
            <EventDetailsTimeline
              mode="edit"
              details={details}
              durationMin={durationMin}
              pxPerMin={pxPerMin}
              eventStartMin={minutesSinceMidnight(start)}
              palette={palette}
              snap={snap}
              focusId={focusId}
              onCreate={add}
              onUpdate={update}
              onRemove={remove}
            />
          )}
        </section>
      </div>
    </>
  );
}
