import { useEffect, useRef, useState } from 'react';
import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import type { PomodoroSession, PomodoroSessionType, PomodoroSettings } from '../types/pomodoro.types';

interface UsePomodoroTimerParams {
  settings: PomodoroSettings;
  onSessionFinished: (session: PomodoroSession) => void;
}

function nextSessionType(completedWorkCount: number, sessionsUntilLongBreak: number): PomodoroSessionType {
  return completedWorkCount > 0 && completedWorkCount % sessionsUntilLongBreak === 0 ? 'long_break' : 'short_break';
}

function durationFor(type: PomodoroSessionType, settings: PomodoroSettings): number {
  if (type === 'work') return settings.workMinutes;
  if (type === 'long_break') return settings.longBreakMinutes;
  return settings.shortBreakMinutes;
}


export function usePomodoroTimer({ settings, onSessionFinished }: UsePomodoroTimerParams) {
  const [currentType, setCurrentType] = useState<PomodoroSessionType>('work');
  const [secondsLeft, setSecondsLeft] = useState(settings.workMinutes * 60);
  const [running, setRunning] = useState(false);
  const startedAtRef = useRef<string | null>(null);
  const completedWorkCountRef = useRef(0);

  function setDescription(description: string) {
    descriptionRef.current = description;
  }

  const descriptionRef = useRef('');

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { finishCurrentSession(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function finishCurrentSession(completed: boolean) {
    if (startedAtRef.current) {
      onSessionFinished({
        id: generateId(),
        type: currentType,
        startedAt: startedAtRef.current,
        completedAt: completed ? toLocalISO(new Date()) : null,
        durationMinutes: durationFor(currentType, settings),
        description: descriptionRef.current.trim() || undefined,
      });
    }
    if (currentType === 'work') completedWorkCountRef.current += 1;

    const nextType = currentType === 'work'
      ? nextSessionType(completedWorkCountRef.current, settings.sessionsUntilLongBreak)
      : 'work';

    setCurrentType(nextType);
    setSecondsLeft(durationFor(nextType, settings) * 60);
    setRunning(false);
    startedAtRef.current = null;
    descriptionRef.current = ''; // limpa pra próxima rodada
  }

  function start() { startedAtRef.current = toLocalISO(new Date()); setRunning(true); }
  function pause() { setRunning(false); }
  function skip() { finishCurrentSession(false); } // interrompida manualmente — completedAt fica null
  function reset() {
    setRunning(false);
    startedAtRef.current = null;
    setSecondsLeft(durationFor(currentType, settings) * 60);
  }

  return { currentType, secondsLeft, running, start, pause, skip, reset, setDescription };
}
