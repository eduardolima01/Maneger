import { useEffect, useState } from 'react';
import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import { appendPomodoroSession } from '../api/pomodoroData';
import { playPomodoroBell } from '../utils/pomodoroBell';
import type { PomodoroSession, PomodoroSessionType, PomodoroSettings } from '../types/pomodoro.types';

interface PomodoroTimerState {
  activeProjectId: string | null;
  activeProjectName: string | null;
  settings: PomodoroSettings;
  currentType: PomodoroSessionType;
  secondsLeft: number;
  running: boolean;
  description: string;
}

type Listener = () => void;

let state: PomodoroTimerState = {
  activeProjectId: null,
  activeProjectName: null,
  settings: { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsUntilLongBreak: 4 },
  currentType: 'work',
  secondsLeft: 25 * 60,
  running: false,
  description: '',
};

let startedAtRef: string | null = null;
let completedWorkCount = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
let persistTick = 0; // incrementa a cada sessão persistida — usado pra PomodoroSection saber quando recarregar histórico

const listeners = new Set<Listener>();
function emit() { listeners.forEach((l) => l()); }

function durationFor(type: PomodoroSessionType, settings: PomodoroSettings): number {
  if (type === 'work') return settings.workMinutes;
  if (type === 'long_break') return settings.longBreakMinutes;
  return settings.shortBreakMinutes;
}

function nextTypeAfterWork(count: number, sessionsUntilLongBreak: number): PomodoroSessionType {
  return count > 0 && count % sessionsUntilLongBreak === 0 ? 'long_break' : 'short_break';
}

function stopInterval() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

function tick() {
  state = { ...state, secondsLeft: state.secondsLeft - 1 };
  if (state.secondsLeft <= 0) finishCurrentSession(true);
  else emit();
}

function finishCurrentSession(completed: boolean) {
  stopInterval();

  if (startedAtRef && state.activeProjectId) {
    const session: PomodoroSession = {
      id: generateId(),
      type: state.currentType,
      startedAt: startedAtRef,
      completedAt: completed ? toLocalISO(new Date()) : null,
      durationMinutes: durationFor(state.currentType, state.settings),
      description: state.description.trim() || undefined,
    };
    appendPomodoroSession(state.activeProjectId, session).then(() => {
      persistTick += 1;
      emit();
    });
    if (completed) playPomodoroBell();
  }

  if (state.currentType === 'work') completedWorkCount += 1;
  const nextType = state.currentType === 'work'
    ? nextTypeAfterWork(completedWorkCount, state.settings.sessionsUntilLongBreak)
    : 'work';

  startedAtRef = null;
  state = { ...state, currentType: nextType, secondsLeft: durationFor(nextType, state.settings) * 60, running: false, description: '' };
  emit();
}

export function startPomodoro(projectId: string, projectName: string, settings: PomodoroSettings) {
  if (state.activeProjectId && state.activeProjectId !== projectId) return; // já tem outro projeto rodando — ignora

  if (!state.activeProjectId) {
    state = { ...state, activeProjectId: projectId, activeProjectName: projectName, settings, secondsLeft: durationFor(state.currentType, settings) * 60 };
  }

  startedAtRef = toLocalISO(new Date());
  state = { ...state, running: true };
  stopInterval();
  intervalId = setInterval(tick, 1000);
  emit();
}

export function pausePomodoro() {
  stopInterval();
  state = { ...state, running: false };
  emit();
}

export function skipPomodoro() {
  finishCurrentSession(false);
}

export function cancelPomodoro() {
  stopInterval();
  startedAtRef = null;
  completedWorkCount = 0;
  state = {
    activeProjectId: null, activeProjectName: null, settings: state.settings,
    currentType: 'work', secondsLeft: state.settings.workMinutes * 60, running: false, description: '',
  };
  emit();
}

export const resetPomodoro = cancelPomodoro;

export function setPomodoroDescription(description: string) {
  state = { ...state, description };
  emit();
}

export function setPomodoroSettings(projectId: string, settings: PomodoroSettings) {
  if (state.activeProjectId && state.activeProjectId !== projectId) return; // não mexe no timer de outro projeto
  state = { ...state, settings };
  if (!state.running) state = { ...state, secondsLeft: durationFor(state.currentType, settings) * 60 };
  emit();
}

export function useGlobalPomodoro() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return { ...state, persistTick };
}

