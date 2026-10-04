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
      className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600"
      style={{
        position: 'fixed', top: y, left: x,
        borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', zIndex: 1000, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220,
      }}
    >
      <div className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11, fontWeight: 600 }}>CRONÔMETRO DO CARD</div>

      <div className={isThisCardActive && timer.running ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-900 dark:text-neutral-100'} style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
        {loading ? '--:--:--' : formatDuration(totalSeconds)}
      </div>

      {otherCardActive ? (
        <p className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 12, textAlign: 'center', margin: 0 }}>
          Outro card está com o cronômetro ativo — pause ou cancele ele primeiro (veja o widget no canto da tela).
        </p>
      ) : !isThisCardActive ? (
        <button onClick={() => startCardTimer(projectId, cardId, cardTitle)} className="bg-blue-600 text-white" style={{ padding: '8px', fontSize: 13, border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          ▶ Iniciar
        </button>
      ) : timer.running ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={pauseCardTimer} style={{ flex: 1, padding: '8px', fontSize: 13, border: 'none', borderRadius: 4, backgroundColor: '#f4511e', color: '#fff', cursor: 'pointer' }}>
            ⏸ Pausar
          </button>
          <button onClick={cancelCardTimer} className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600" style={{ flex: 1, padding: '8px', fontSize: 13, borderRadius: 4, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => startCardTimer(projectId, cardId, cardTitle)} className="bg-blue-600 text-white" style={{ padding: '8px', fontSize: 13, border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            ▶ Retomar
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={async () => { await finishCardTimerSession(); await loadSessions(); }} style={{ flex: 1, padding: '8px', fontSize: 13, border: 'none', borderRadius: 4, backgroundColor: '#2e7d32', color: '#fff', cursor: 'pointer' }}>
              ✔ Finalizar sessão
            </button>
            <button onClick={cancelCardTimer} className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600" style={{ flex: 1, padding: '8px', fontSize: 12, borderRadius: 4, cursor: 'pointer' }}>
              Descartar
            </button>
          </div>
        </div>
      )}

      {isThisCardActive && (
        <div className="border-t border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10 }}>
          <input
            value={timer.sessionTitle}
            onChange={(e) => setCardTimerSessionTitle(e.target.value)}
            placeholder="Título desta sessão..."
            className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark] border border-neutral-300 dark:border-neutral-600"
            style={{ padding: 6, fontSize: 12, borderRadius: 4 }}
          />
          <textarea
            value={timer.sessionDescription}
            onChange={(e) => setCardTimerSessionDescription(e.target.value)}
            placeholder="O que está sendo feito..."
            rows={2}
            className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark] border border-neutral-300 dark:border-neutral-600"
            style={{ padding: 6, fontSize: 12, borderRadius: 4, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      )}

      <div className="border-t border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 10 }}>
        <input
          type="number" min={1} value={adjustMinutes}
          onChange={(e) => setAdjustMinutes(Number(e.target.value))}
          className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]" style={{ width: 50, padding: 4, fontSize: 12 }}
        />
        <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11 }}>min</span>
        <button onClick={() => handleAdjust(1)} className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600" style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}>+ Tempo</button>
        <button onClick={() => handleAdjust(-1)} className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600" style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}>− Tempo</button>
      </div>

      <button
        onClick={() => setShowHistory((v) => !v)}
        className="text-blue-600 dark:text-blue-400"
        style={{ fontSize: 12, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
      >
        {showHistory ? '▲ Ocultar histórico' : `▼ Ver histórico (${sessions.length})`}
      </button>

      {showHistory && (
        <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sessions.length === 0 && <p className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 12, margin: 0 }}>Nenhuma sessão ainda.</p>}
          {sessions.map((s) => (
            <div key={s.id} className="border-b border-neutral-100 dark:border-neutral-700" style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  defaultValue={s.title ?? ''}
                  onBlur={(e) => handleEditSessionTitle(s, e.target.value)}
                  placeholder={s.manual ? '⚙ Ajuste' : new Date(s.startAt).toLocaleDateString('pt-BR')}
                  className="border border-transparent focus:border-neutral-300 dark:focus:border-neutral-600 bg-transparent text-neutral-900 dark:text-neutral-100" style={{ flex: 1, padding: 2, fontSize: 12, borderRadius: 3 }}
                />
                <input
                  type="number"
                  defaultValue={(s.durationSeconds / 60).toFixed(1)}
                  onBlur={(e) => handleEditSessionMinutes(s, Number(e.target.value))}
                  className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]" style={{ width: 50, padding: 2, fontSize: 11 }}
                />
                <span className="text-neutral-400 dark:text-neutral-500">min</span>
                {!timer.activeCardId && (
                  <button onClick={() => handleResumeSession(s)} title="Retomar e somar tempo nesta sessão" className="text-blue-600 dark:text-blue-400" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>▶</button>
                )}
                <button onClick={() => handleDeleteSession(s)} className="text-red-600 dark:text-red-400" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
              </div>
              <input
                defaultValue={s.description ?? ''}
                onBlur={(e) => handleEditSessionDescription(s, e.target.value)}
                placeholder="Sem descrição"
                className="border border-transparent focus:border-neutral-300 dark:focus:border-neutral-600 bg-transparent text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11, padding: 2, borderRadius: 3 }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
