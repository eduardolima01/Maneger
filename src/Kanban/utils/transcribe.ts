import { convertFileSrc } from '@tauri-apps/api/core';
import { deleteCardFile } from '@/Kanban/api/kanbanCardAssets';
import { saveBytesInCard, notifyCardMediaChanged } from './cardMedia';
import { playDoneSound } from './sounds';

/** Idioma falado nos áudios (nome do idioma do Whisper). */
const LANGUAGE = 'portuguese';

export interface TranscribeState { phase: 'queue' | 'download' | 'running' | 'error'; pct?: number; msg?: string }

const STATUS_EVT = 'card-transcribe-status';
const states = new Map<string, TranscribeState>();
const key = (cardId: string, name: string) => `${cardId}/${name}`;

export function getTranscribeState(cardId: string, audioName: string): TranscribeState | undefined {
  return states.get(key(cardId, audioName));
}

function setState(k: string, s: TranscribeState | null): void {
  if (s) states.set(k, s); else states.delete(k);
  window.dispatchEvent(new Event(STATUS_EVT));
}

/** Avisa quando algum estado de transcrição desta janela mudar (fila, baixando modelo, rodando, erro). */
export function onTranscribeStatus(cb: () => void): () => void {
  window.addEventListener(STATUS_EVT, cb);
  return () => window.removeEventListener(STATUS_EVT, cb);
}

/** Nome do arquivo de transcrição que acompanha um áudio: mesmo nome, extensão .txt. */
export function transcriptNameFor(audioName: string): string {
  return audioName.replace(/\.[^.]+$/, '') + '.txt';
}

// ── worker ────────────────────────────────────────────────────────────────────────────────────
type Pending = { resolve: (t: string) => void; reject: (e: Error) => void; onProgress: (p: { status?: string; progress?: number }) => void };
let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./transcribeWorker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<{ id: number; type: 'progress' | 'result' | 'error'; p?: { status?: string; progress?: number }; text?: string; message?: string }>) => {
    const m = e.data;
    const job = waiting.get(m.id);
    if (!job) return;
    if (m.type === 'progress') job.onProgress(m.p ?? {});
    else if (m.type === 'result') { waiting.delete(m.id); job.resolve(m.text ?? ''); }
    else { waiting.delete(m.id); job.reject(new Error(m.message ?? 'erro na transcrição')); }
  };
  w.onerror = (e) => {
    const err = new Error(e.message || 'erro no worker de transcrição');
    for (const j of waiting.values()) j.reject(err);
    waiting.clear();
    worker = null;
  };
  worker = w;
  return w;
}

function ask(audio: Float32Array, onProgress: Pending['onProgress']): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, audio, language: LANGUAGE }, [audio.buffer]);
  });
}

/** Decodifica o áudio gravado e reamostra pra 16 kHz mono (o formato que o Whisper espera). */
async function decodeTo16k(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer();
  const ac = new AudioContext();
  let decoded: AudioBuffer;
  try { decoded = await ac.decodeAudioData(buf); } finally { void ac.close(); }
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * 16000)), 16000);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return rendered.getChannelData(0).slice();
}

// ── fila (uma transcrição por vez) ────────────────────────────────────────────────────────────
let chain: Promise<unknown> = Promise.resolve();

/**
 * Transcreve o áudio e guarda o texto como `<nome-do-audio>.txt` na pasta do card.
 * Roda em segundo plano (continua mesmo se o painel do card for fechado); erros ficam no estado, não são lançados.
 */
export function transcribeAudioBlob(cardId: string, audioName: string, blob: Blob): Promise<void> {
  const k = key(cardId, audioName);
  setState(k, { phase: 'queue' });
  const job = chain.then(() => run(cardId, audioName, blob, k));
  chain = job.catch(() => { });
  return job;
}

async function run(cardId: string, audioName: string, blob: Blob, k: string): Promise<void> {
  try {
    const audio = await decodeTo16k(blob);
    setState(k, { phase: 'running' });
    const text = await ask(audio, (p) => {
      if (p.status === 'progress' && typeof p.progress === 'number') setState(k, { phase: 'download', pct: Math.round(p.progress) });
      else if (p.status === 'ready') setState(k, { phase: 'running' });
    });
    const clean = text.trim() || '(nenhuma fala detectada)';
    const txtName = transcriptNameFor(audioName);
    try { await deleteCardFile(cardId, txtName); } catch { /* não existia */ }
    await saveBytesInCard(cardId, new TextEncoder().encode(clean), 'txt', txtName);
    setState(k, null);
    notifyCardMediaChanged(cardId);
    void playDoneSound();
  } catch (e) {
    setState(k, { phase: 'error', msg: e instanceof Error ? e.message : String(e) });
  }
}

/** (Re)transcreve um áudio que já está salvo no card (ex.: gravado antes da transcrição existir, ou que falhou). */
export async function transcribeSavedAudio(cardId: string, audioName: string, audioPath: string): Promise<void> {
  const k = key(cardId, audioName);
  setState(k, { phase: 'queue' });
  try {
    const blob = await (await fetch(convertFileSrc(audioPath))).blob();
    await transcribeAudioBlob(cardId, audioName, blob);
  } catch (e) {
    setState(k, { phase: 'error', msg: e instanceof Error ? e.message : String(e) });
  }
}
