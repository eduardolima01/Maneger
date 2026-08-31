import { useEffect, useLayoutEffect, useRef } from 'react';
import Button from '@/components/layout/Button';
import { useGlobalCardTimer, pauseCardTimer, cancelCardTimer, startCardTimer, restoreCardTimerFromDisk, finishCardTimerSession } from '../store/cardTimerStore';

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
    : [m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function GlobalCardTimerWidget() {
  const timer = useGlobalCardTimer();
  const widgetRef = useRef<HTMLDivElement>(null);

  // mesmo contorno de reflow do GlobalPomodoroWidget — position:fixed isolado
  // às vezes não repinta sozinho no WebView2 quando só o texto muda.
  useEffect(() => { restoreCardTimerFromDisk(); }, []);

  useLayoutEffect(() => {

    if (widgetRef.current) void widgetRef.current.offsetHeight;
  }, [timer.elapsedSeconds]);

  if (!timer.activeCardId) return null;

  return (
    <div
      ref={widgetRef}
      style={{
        position: 'fixed', bottom: 16, left: '50%', zIndex: 1500,
        background: '#fff', border: '1px solid #ddd', borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10, minWidth: 200,
        transform: 'translate(-50%, 0) translateZ(0)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
          ⏱ {timer.activeCardTitle}
        </div>
        {timer.sessionTitle && (
          <div style={{ fontSize: 11, color: '#1a73e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
            {timer.sessionTitle}
          </div>
        )}
        <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {formatDuration(timer.elapsedSeconds)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
        {!timer.running
          ? <Button onClick={() => startCardTimer(timer.activeProjectId!, timer.activeCardId!, timer.activeCardTitle!)} aria-label="Retomar">▶</Button>
          : <Button onClick={pauseCardTimer} aria-label="Pausar">⏸</Button>}
        {!timer.running && <Button onClick={finishCardTimerSession} aria-label="Finalizar sessão">✔</Button>}
        <Button onClick={cancelCardTimer} aria-label="Cancelar">✕</Button>
      </div>
    </div>
  );
}
