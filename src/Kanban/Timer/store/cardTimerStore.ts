import { useEffect, useState } from 'react';
import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import { CardTimerSession } from '../types/cardTimer.types';
import { addSecondsToSession, appendCardTimerSession, updateCardTimerSession } from '../cardTimer';
import { clearActiveCardTimer, loadActiveCardTimer, saveActiveCardTimer } from '../activeCardTimer';

interface CardTimerState {
  activeProjectId: string | null;
  activeCardId: string | null;
  activeCardTitle: string | null;
  running: boolean;
  elapsedSeconds: number; // tempo desta sessão em andamento (zera a cada Pausar, igual ao modelo de sessões)
  sessionTitle: string;
  sessionDescription: string;
}

type Listener = () => void;

let state: CardTimerState = {
  activeProjectId: null,
  activeCardId: null,
  activeCardTitle: null,
  running: false,
  elapsedSeconds: 0,
  sessionTitle: '',
  sessionDescription: '',
};

let startedAtMs: number | null = null;
let baselineSeconds = 0; // soma de todos os segmentos já pausados dentro da sessão em aberto
let sessionStartedAtRef: string | null = null; // início real da sessão (primeira vez que ela foi iniciada, sobrevive a pausas)
let resumingSessionId: string | null = null;

let intervalId: ReturnType<typeof setInterval> | null = null;
let restored = false; // garante que a restauração do disco só roda uma vez por sessão do app
let persistTickCount = 0;
const listeners = new Set<Listener>();
function emit() { listeners.forEach((l) => l()); }

function stopInterval() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

function tick() {
  if (startedAtMs === null) return;
  const segmentSeconds = Math.floor((Date.now() - startedAtMs) / 1000);
  state = { ...state, elapsedSeconds: baselineSeconds + segmentSeconds };
  emit();

  persistTickCount += 1;
  if (persistTickCount % 10 === 0 && state.activeProjectId && state.activeCardId) {
    // persiste o valor já decorrido a cada ~5s (congelado, não o horário de início — se o app fechar,
    // reabrir deve trazer esse número parado, não recalcular pelo relógio de parede)
    saveActiveCardTimer({
      projectId: state.activeProjectId, cardId: state.activeCardId, cardTitle: state.activeCardTitle ?? '',
      sessionTitle: state.sessionTitle, sessionDescription: state.sessionDescription,
      elapsedSeconds: state.elapsedSeconds,
      sessionStartedAt: sessionStartedAtRef ?? toLocalISO(new Date()),
      resumingSessionId,
    });
  }
}

export function startCardTimer(projectId: string, cardId: string, cardTitle: string) {
  if (state.activeCardId && state.activeCardId !== cardId) return; // outro card já rodando — precisa pausar/cancelar antes

  const resumingSameDraft = state.activeCardId === cardId;
  if (!resumingSameDraft) {
    // primeira vez começando neste card — zera tudo e marca o início real da sessão
    baselineSeconds = 0;
    sessionStartedAtRef = toLocalISO(new Date());
    state = { ...state, activeProjectId: projectId, activeCardId: cardId, activeCardTitle: cardTitle, running: true, elapsedSeconds: 0 };
  } else {
    // retomando um card já pausado — preserva o que já tinha acumulado
    baselineSeconds = state.elapsedSeconds;
    state = { ...state, running: true };
  }
  startedAtMs = Date.now();
  persistTickCount = 0;
  stopInterval();
  intervalId = setInterval(tick, 1000);
  emit();
}

export async function pauseCardTimer(): Promise<void> {
  if (!state.activeCardId || startedAtMs === null) return;
  stopInterval();
  baselineSeconds = state.elapsedSeconds; // congela — próxima retomada soma a partir daqui
  startedAtMs = null;
  state = { ...state, running: false };
  emit();
  await saveActiveCardTimer({
    projectId: state.activeProjectId!, cardId: state.activeCardId!, cardTitle: state.activeCardTitle ?? '',
    sessionTitle: state.sessionTitle, sessionDescription: state.sessionDescription,
    elapsedSeconds: state.elapsedSeconds,
    sessionStartedAt: sessionStartedAtRef ?? toLocalISO(new Date()),
    resumingSessionId,
  });
}

export async function finishCardTimerSession(): Promise<void> {
  if (!state.activeCardId) return;
  stopInterval();
  const endMs = Date.now();
  const durationSeconds = Math.max(1, state.elapsedSeconds);
  const { activeProjectId, activeCardId } = state;

  const resumedId = resumingSessionId;
  const titleAtFinish = state.sessionTitle.trim() || undefined;
  const descriptionAtFinish = state.sessionDescription.trim() || undefined;
  startedAtMs = null;
  baselineSeconds = 0;
  sessionStartedAtRef = null;
  resumingSessionId = null;
  state = { ...state, activeProjectId: null, activeCardId: null, activeCardTitle: null, running: false, elapsedSeconds: 0, sessionTitle: '', sessionDescription: '' };
  emit();
  await clearActiveCardTimer();
  if (!activeProjectId || !activeCardId) return;
  if (resumedId) {
    await addSecondsToSession(activeProjectId, activeCardId, resumedId, durationSeconds, toLocalISO(new Date(endMs)));
    if (titleAtFinish !== undefined || descriptionAtFinish !== undefined) {
      await updateCardTimerSession(activeProjectId, activeCardId, resumedId, { title: titleAtFinish, description: descriptionAtFinish });
    }
  } else {
    const session: CardTimerSession = {
      id: generateId(), startAt: sessionStartedAtRef ?? toLocalISO(new Date(endMs)), endAt: toLocalISO(new Date(endMs)),
      durationSeconds, title: titleAtFinish, description: descriptionAtFinish,
    };
    await appendCardTimerSession(activeProjectId, activeCardId, session);
  }
}

export function cancelCardTimer() {
  stopInterval();
  startedAtMs = null;
  baselineSeconds = 0;
  sessionStartedAtRef = null;
  resumingSessionId = null;
  state = { activeProjectId: null, activeCardId: null, activeCardTitle: null, running: false, elapsedSeconds: 0, sessionTitle: '', sessionDescription: '' };
  emit();
  clearActiveCardTimer();
}

export function useGlobalCardTimer() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return state;
}


export function setCardTimerSessionTitle(title: string) {
  state = { ...state, sessionTitle: title };
  emit();
}

export function setCardTimerSessionDescription(description: string) {
  state = { ...state, sessionDescription: description };
  emit();
}

// chamado uma vez, na montagem do widget global — restaura o "rascunho" persistido como PAUSADO,
// nunca retoma a contagem sozinho (comportamento pedido: volta pausado, preservando o tempo já feito)
export async function restoreCardTimerFromDisk() {
  if (restored) return;
  restored = true;
  const persisted = await loadActiveCardTimer();
  if (!persisted) return;
  state = {
    activeProjectId: persisted.projectId, activeCardId: persisted.cardId, activeCardTitle: persisted.cardTitle,
    running: false, elapsedSeconds: persisted.elapsedSeconds,
    sessionTitle: persisted.sessionTitle, sessionDescription: persisted.sessionDescription,
  };
  emit();
}

export function resumeCardTimerFromSession(
  projectId: string, cardId: string, cardTitle: string, session: CardTimerSession
): void {
  if (state.activeCardId) return; // já existe um draft rodando/pausado em algum card — precisa finalizar/descartar antes
  baselineSeconds = 0;
  sessionStartedAtRef = session.startAt;
  resumingSessionId = session.id;
  state = {
    ...state, activeProjectId: projectId, activeCardId: cardId, activeCardTitle: cardTitle,
    running: true, elapsedSeconds: 0, sessionTitle: session.title ?? '', sessionDescription: session.description ?? '',
  };
  startedAtMs = Date.now();
  persistTickCount = 0;
  stopInterval();
  intervalId = setInterval(tick, 1000);
  emit();
}
