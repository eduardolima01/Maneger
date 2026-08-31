import { useEffect, useRef, useState } from 'react';
import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import { useGlobalCardTimer, startCardTimer, pauseCardTimer, cancelCardTimer, setCardTimerSessionTitle, setCardTimerSessionDescription, finishCardTimerSession, resumeCardTimerFromSession } from './store/cardTimerStore';
import { CardTimerSession } from './types/cardTimer.types';
import { getCardTimerSessions, appendCardTimerSession, updateCardTimerSession, deleteCardTimerSession, } from './cardTimer';

interface CardTimerPopupProps {
  x: number;
  y: number;
  projectId: string;
  cardId: string;
  cardTitle: string;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function CardTimerPopup({ x, y, projectId, cardId, cardTitle, onClose, onMouseEnter, onMouseLeave }: CardTimerPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useGlobalCardTimer();
  const [sessions, setSessions] = useState<CardTimerSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [adjustMinutes, setAdjustMinutes] = useState(15);
  const [loading, setLoading] = useState(true);

  const isThisCardActive = timer.activeCardId === cardId;
  const otherCardActive = !!timer.activeCardId && !isThisCardActive;

  async function loadSessions() {
    const s = await getCardTimerSessions(projectId, cardId);
    setSessions(s);
    setLoading(false);
  }

  useEffect(() => { loadSessions(); }, [projectId, cardId]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const savedTotalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const runningSeconds = isThisCardActive ? timer.elapsedSeconds : 0;
  const totalSeconds = savedTotalSeconds + runningSeconds;

  async function handleAdjust(sign: 1 | -1) {
    if (adjustMinutes <= 0) return;
    const now = toLocalISO(new Date());
    const session: CardTimerSession = {
      id: generateId(), startAt: now, endAt: now, durationSeconds: sign * adjustMinutes * 60, manual: true,
    };
    setSessions((prev) => [session, ...prev]);
    await appendCardTimerSession(projectId, cardId, session);
  }

  async function handleEditSessionMinutes(session: CardTimerSession, minutes: number) {
    const durationSeconds = Math.round(minutes * 60);
    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, durationSeconds } : s)));
    await updateCardTimerSession(projectId, cardId, session.id, { durationSeconds });
  }

  async function handleDeleteSession(session: CardTimerSession) {
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    await deleteCardTimerSession(projectId, cardId, session.id);
  }

  async function handleEditSessionTitle(session: CardTimerSession, title: string) {
    const value = title.trim() || undefined;
    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, title: value } : s)));
    await updateCardTimerSession(projectId, cardId, session.id, { title: value });
  }

  async function handleEditSessionDescription(session: CardTimerSession, description: string) {
    const value = description.trim() || undefined;
    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, description: value } : s)));
    await updateCardTimerSession(projectId, cardId, session.id, { description: value });
  }

  function handleResumeSession(session: CardTimerSession) {
    resumeCardTimerFromSession(projectId, cardId, cardTitle, session);
  }

  return (
    <div
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed', top: y, left: x, backgroundColor: '#fff', border: '1px solid #ddd',
        borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', zIndex: 1000, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: '#999' }}>CRONÔMETRO DO CARD</div>

      <div style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: isThisCardActive && timer.running ? '#1a73e8' : '#000' }}>
        {loading ? '--:--:--' : formatDuration(totalSeconds)}
      </div>

      {otherCardActive ? (
        <p style={{ fontSize: 12, color: '#999', textAlign: 'center', margin: 0 }}>
          Outro card está com o cronômetro ativo — pause ou cancele ele primeiro (veja o widget no canto da tela).
        </p>
      ) : !isThisCardActive ? (
        <button onClick={() => startCardTimer(projectId, cardId, cardTitle)} style={{ padding: '8px', fontSize: 13, border: 'none', borderRadius: 4, backgroundColor: '#1a73e8', color: '#fff', cursor: 'pointer' }}>
          ▶ Iniciar
        </button>
      ) : timer.running ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={pauseCardTimer} style={{ flex: 1, padding: '8px', fontSize: 13, border: 'none', borderRadius: 4, backgroundColor: '#f4511e', color: '#fff', cursor: 'pointer' }}>
            ⏸ Pausar
          </button>
          <button onClick={cancelCardTimer} style={{ flex: 1, padding: '8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => startCardTimer(projectId, cardId, cardTitle)} style={{ padding: '8px', fontSize: 13, border: 'none', borderRadius: 4, backgroundColor: '#1a73e8', color: '#fff', cursor: 'pointer' }}>
            ▶ Retomar
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={async () => { await finishCardTimerSession(); await loadSessions(); }} style={{ flex: 1, padding: '8px', fontSize: 13, border: 'none', borderRadius: 4, backgroundColor: '#2e7d32', color: '#fff', cursor: 'pointer' }}>
              ✔ Finalizar sessão
            </button>
            <button onClick={cancelCardTimer} style={{ flex: 1, padding: '8px', fontSize: 12, border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>
              Descartar
            </button>
          </div>
        </div>
      )}

      {isThisCardActive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #eee', paddingTop: 10 }}>
          <input
            value={timer.sessionTitle}
            onChange={(e) => setCardTimerSessionTitle(e.target.value)}
            placeholder="Título desta sessão..."
            style={{ padding: 6, fontSize: 12, border: '1px solid #ddd', borderRadius: 4 }}
          />
          <textarea
            value={timer.sessionDescription}
            onChange={(e) => setCardTimerSessionDescription(e.target.value)}
            placeholder="O que está sendo feito..."
            rows={2}
            style={{ padding: 6, fontSize: 12, border: '1px solid #ddd', borderRadius: 4, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid #eee', paddingTop: 10 }}>
        <input
          type="number" min={1} value={adjustMinutes}
          onChange={(e) => setAdjustMinutes(Number(e.target.value))}
          style={{ width: 50, padding: 4, fontSize: 12 }}
        />
        <span style={{ fontSize: 11, color: '#666' }}>min</span>
        <button onClick={() => handleAdjust(1)} style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>+ Tempo</button>
        <button onClick={() => handleAdjust(-1)} style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>− Tempo</button>
      </div>

      <button
        onClick={() => setShowHistory((v) => !v)}
        style={{ fontSize: 12, color: '#1a73e8', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
      >
        {showHistory ? '▲ Ocultar histórico' : `▼ Ver histórico (${sessions.length})`}
      </button>

      {showHistory && (
        <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sessions.length === 0 && <p style={{ fontSize: 12, color: '#999', margin: 0 }}>Nenhuma sessão ainda.</p>}
          {sessions.map((s) => (
            <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, paddingBottom: 4, borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  defaultValue={s.title ?? ''}
                  onBlur={(e) => handleEditSessionTitle(s, e.target.value)}
                  placeholder={s.manual ? '⚙ Ajuste' : new Date(s.startAt).toLocaleDateString('pt-BR')}
                  style={{ flex: 1, padding: 2, fontSize: 12, border: '1px solid transparent', borderRadius: 3 }}
                  onFocus={(e) => (e.target.style.border = '1px solid #ddd')}
                />
                <input
                  type="number"
                  defaultValue={(s.durationSeconds / 60).toFixed(1)}
                  onBlur={(e) => handleEditSessionMinutes(s, Number(e.target.value))}
                  style={{ width: 50, padding: 2, fontSize: 11 }}
                />
                <span style={{ color: '#999' }}>min</span>
                {!timer.activeCardId && (
                  <button onClick={() => handleResumeSession(s)} title="Retomar e somar tempo nesta sessão" style={{ border: 'none', background: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: 12 }}>▶</button>
                )}
                <button onClick={() => handleDeleteSession(s)} style={{ border: 'none', background: 'none', color: '#c62828', cursor: 'pointer', fontSize: 12 }}>✕</button>
              </div>
              <input
                defaultValue={s.description ?? ''}
                onBlur={(e) => handleEditSessionDescription(s, e.target.value)}
                placeholder="Sem descrição"
                style={{ fontSize: 11, color: '#999', padding: 2, border: '1px solid transparent', borderRadius: 3 }}
                onFocus={(e) => (e.target.style.border = '1px solid #ddd')}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
