import Button from '@/components/layout/Button';
import { useGlobalPomodoro, pausePomodoro, startPomodoro, skipPomodoro, cancelPomodoro } from '../store/pomodoroTimerStore';
import { useLayoutEffect, useRef } from 'react';

const TYPE_LABELS: Record<string, string> = { work: 'Foco', short_break: 'Pausa curta', long_break: 'Pausa longa' };

export default function GlobalPomodoroWidget() {
  const pomodoro = useGlobalPomodoro();

  const widgetRef = useRef<HTMLDivElement>(null);

  // Força reflow síncrono a cada segundo — contorna um bug conhecido de engines Chromium
  // (WebView2 incluso) onde um elemento position:fixed isolado não repinta sozinho quando
  // só o texto muda, mesmo com o estado React atualizando corretamente por baixo.
  useLayoutEffect(() => {
    if (widgetRef.current) void widgetRef.current.offsetHeight;
  }, [pomodoro.secondsLeft]);

  if (!pomodoro.activeProjectId) return null;

  const minutes = String(Math.floor(pomodoro.secondsLeft / 60)).padStart(2, '0');
  const seconds = String(pomodoro.secondsLeft % 60).padStart(2, '0');

  return (
    <div
      ref={widgetRef}
      style={{
        background: '#fff', border: '1px solid #ddd', borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10, minWidth: 200,
        transform: 'translateZ(0)',
        willChange: 'contents',
      }}>
      <div>
        <div style={{ fontSize: 11, color: '#888' }}>{pomodoro.activeProjectName} · {TYPE_LABELS[pomodoro.currentType]}</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{minutes}:{seconds}</div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
        {!pomodoro.running
          ? <Button onClick={() => startPomodoro(pomodoro.activeProjectId!, pomodoro.activeProjectName!, pomodoro.settings)} aria-label="Retomar">▶</Button>
          : <Button onClick={pausePomodoro} aria-label="Pausar">⏸</Button>}
        <Button onClick={skipPomodoro} aria-label="Pular">⏭</Button>
        <Button onClick={cancelPomodoro} aria-label="Cancelar">✕</Button>
      </div>
    </div>
  );
}
