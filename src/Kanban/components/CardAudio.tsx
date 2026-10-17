import { useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listCardFiles, deleteCardFile } from '@/Kanban/api/kanbanCardAssets';
import { saveBytesInCard, notifyCardMediaChanged, onCardMediaChanged, fmtDuration } from '@/Kanban/utils/cardMedia';
import { playStartSound, playStopSound, playDiscardSound } from '@/Kanban/utils/sounds';
import { transcribeAudioBlob, transcribeSavedAudio, transcriptNameFor, getTranscribeState, onTranscribeStatus } from '@/Kanban/utils/transcribe';
import type { TranscribeState } from '@/Kanban/utils/transcribe';

/**
 * Áudio gravado ligado ao TÍTULO ou à DESCRIÇÃO de um card, com transcrição.
 *
 * Cada áudio é um arquivo comum em `card-files/{cardId}/` chamado `audio-<campo>-<timestamp>-<segundos>s.<ext>`
 * (o nome carrega campo, data e duração) e a transcrição é o `.txt` de mesmo nome ao lado dele.
 * Sons: início = dois bips subindo, fim = dois descendo, descarte = tom grave, transcrição pronta = acorde.
 */
export type AudioField = 'title' | 'description';

interface AudioItem { name: string; path: string; field: AudioField; ts: number; secs: number; txtPath: string | null }

const NAME_RE = /^audio-(title|description)-(\d+)-(\d+)s\.(webm|m4a|ogg|mp4|wav)$/i;

function pickMime(): { mime: string; ext: string } {
  const opts = [
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
    { mime: 'audio/mp4', ext: 'm4a' },
    { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
  ];
  for (const o of opts) {
    try { if (MediaRecorder.isTypeSupported(o.mime)) return o; } catch { /* tenta o próximo */ }
  }
  return { mime: '', ext: 'webm' };
}

function useAudios(cardId: string, field: AudioField): AudioItem[] {
  const [items, setItems] = useState<AudioItem[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const files = await listCardFiles(cardId);
        const txt = new Map(files.map((f) => [f.name, f.path]));
        const list: AudioItem[] = [];
        for (const f of files) {
          const m = NAME_RE.exec(f.name);
          if (!m || m[1].toLowerCase() !== field) continue;
          list.push({ name: f.name, path: f.path, field, ts: Number(m[2]), secs: Number(m[3]), txtPath: txt.get(transcriptNameFor(f.name)) ?? null });
        }
        list.sort((a, b) => a.ts - b.ts);
        if (alive) setItems(list);
      } catch { if (alive) setItems([]); }
    };
    void load();
    const off = onCardMediaChanged(cardId, () => void load());
    return () => { alive = false; off(); };
  }, [cardId, field]);
  return items;
}

/** Linha de um áudio: player, duração, apagar e a transcrição (editável). */
function AudioRow({ cardId, a, onError }: { cardId: string; a: AudioItem; onError: (m: string) => void }) {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(true);
  const [state, setState] = useState<TranscribeState | undefined>(() => getTranscribeState(cardId, a.name));

  useEffect(() => onTranscribeStatus(() => setState(getTranscribeState(cardId, a.name))), [cardId, a.name]);

  useEffect(() => {
    let alive = true;
    if (!a.txtPath) { setText(''); setDraft(''); return; }
    fetch(convertFileSrc(a.txtPath)).then((r) => r.text()).then((t) => { if (alive) { setText(t); setDraft(t); } }).catch(() => { });
    return () => { alive = false; };
  }, [a.txtPath]);

  async function saveTranscript() {
    if (draft === text) return;
    const txtName = transcriptNameFor(a.name);
    try {
      if (a.txtPath) await deleteCardFile(cardId, txtName);
      if (draft.trim()) await saveBytesInCard(cardId, new TextEncoder().encode(draft.trim()), 'txt', txtName);
      notifyCardMediaChanged(cardId);
    } catch (e) { onError(`Falha ao salvar a transcrição: ${e instanceof Error ? e.message : String(e)}`); }
  }

  async function remove() {
    try {
      await deleteCardFile(cardId, a.name);
      if (a.txtPath) { try { await deleteCardFile(cardId, transcriptNameFor(a.name)); } catch { /* ignora */ } }
      notifyCardMediaChanged(cardId);
    } catch (e) { onError(`Falha ao apagar o áudio: ${e instanceof Error ? e.message : String(e)}`); }
  }

  const busy = state && state.phase !== 'error';
  const faint = 'text-neutral-500 dark:text-neutral-400';
  const link = 'bg-transparent border-0 cursor-pointer text-indigo-700 dark:text-indigo-300 underline';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <audio controls preload="none" src={convertFileSrc(a.path)} style={{ height: 28, flex: 1, minWidth: 0, maxWidth: 320 }} />
        <span className={faint} style={{ fontSize: 11, whiteSpace: 'nowrap' }} title={new Date(a.ts).toLocaleString()}>{fmtDuration(a.secs)}</span>
        <button type="button" onClick={() => setOpen((v) => !v)} title={open ? 'Ocultar transcrição' : 'Mostrar transcrição'} className={`${faint} bg-transparent border-0 cursor-pointer`} style={{ fontSize: 12 }}>📝</button>
        <button type="button" onClick={() => void remove()} title="Apagar áudio" aria-label="Apagar áudio" className="text-neutral-400 hover:text-red-600 dark:hover:text-red-400 bg-transparent border-0 cursor-pointer" style={{ fontSize: 12 }}>✕</button>
      </div>

      {busy && (
        <span className={faint} style={{ fontSize: 11 }}>
          {state.phase === 'queue' && '📝 Na fila para transcrever…'}
          {state.phase === 'download' && `📝 Baixando o modelo de transcrição${state.pct != null ? ` (${state.pct}%)` : ''} — só na primeira vez…`}
          {state.phase === 'running' && '📝 Transcrevendo…'}
        </span>
      )}
      {state?.phase === 'error' && (
        <span className="text-red-600 dark:text-red-400" style={{ fontSize: 11 }}>
          Falha na transcrição: {state.msg}{' '}
          <button type="button" className={link} style={{ fontSize: 11 }} onClick={() => void transcribeSavedAudio(cardId, a.name, a.path)}>tentar de novo</button>
        </span>
      )}
      {!busy && state?.phase !== 'error' && !a.txtPath && (
        <button type="button" className={link} style={{ fontSize: 11, alignSelf: 'flex-start' }} onClick={() => void transcribeSavedAudio(cardId, a.name, a.path)}>📝 Transcrever</button>
      )}
      {open && a.txtPath && (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void saveTranscript()}
          rows={Math.min(6, Math.max(2, Math.ceil(draft.length / 60)))}
          aria-label="Transcrição do áudio"
          className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600"
          style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: 6, borderRadius: 4, resize: 'vertical', fontFamily: 'inherit' }}
        />
      )}
    </div>
  );
}

interface Props {
  cardId: string;
  field: AudioField;
  /** Visual compacto (janela do modo trabalho): só o ícone no botão. */
  compact?: boolean;
}

export default function CardAudio({ cardId, field, compact }: Props) {
  const items = useAudios(cardId, field);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const cancelRef = useRef(false);

  // fecha o microfone se o componente sumir no meio da gravação (descarta o áudio)
  useEffect(() => () => {
    cancelRef.current = true;
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); } catch { /* ignora */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - startedRef.current) / 1000)), 250);
    return () => window.clearInterval(id);
  }, [recording]);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este ambiente não suporta gravação de áudio.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const { mime, ext } = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      cancelRef.current = false;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const secs = Math.max(1, Math.round((Date.now() - startedRef.current) / 1000));
        if (cancelRef.current) { chunksRef.current = []; return; }
        void persist(new Blob(chunksRef.current, { type: rec.mimeType || mime || 'audio/webm' }), ext, secs);
      };
      recRef.current = rec;
      await playStartSound();            // o bip termina ANTES de gravar, pra não entrar no áudio
      if (cancelRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      startedRef.current = Date.now();
      setElapsed(0);
      rec.start();
      setRecording(true);
    } catch (e) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const msg = e instanceof Error ? e.message : String(e);
      setError(/denied|NotAllowed|Permission/i.test(msg) ? 'Permissão do microfone negada.' : `Não foi possível gravar: ${msg}`);
    }
  }

  function stop(save: boolean) {
    cancelRef.current = !save;
    setRecording(false);
    try { recRef.current?.stop(); } catch { /* já parado */ }
    void (save ? playStopSound() : playDiscardSound());
  }

  async function persist(blob: Blob, ext: string, secs: number) {
    setBusy(true);
    try {
      const name = `audio-${field}-${Date.now()}-${secs}s.${ext}`;
      await saveBytesInCard(cardId, new Uint8Array(await blob.arrayBuffer()), ext, name);
      notifyCardMediaChanged(cardId);
      void transcribeAudioBlob(cardId, name, blob);   // segundo plano: o texto aparece sozinho quando ficar pronto
    } catch (e) {
      setError(`Falha ao salvar o áudio: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  }

  const label = field === 'title' ? 'título' : 'descrição';
  const btn = 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 bg-transparent cursor-pointer';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} onKeyDown={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {!recording ? (
          <button
            type="button" disabled={busy} onClick={() => void start()}
            title={`Gravar áudio do ${label}`} aria-label={`Gravar áudio do ${label}`}
            className={btn} style={{ borderRadius: 4, padding: compact ? '1px 6px' : '2px 8px', fontSize: 12, opacity: busy ? 0.5 : 1 }}
          >
            🎙{compact ? '' : ` Gravar áudio${field === 'title' ? ' do título' : ''}`}
          </button>
        ) : (
          <>
            <span className="text-red-600 dark:text-red-400" style={{ fontSize: 12, fontWeight: 600 }}>● {fmtDuration(elapsed)}</span>
            <button type="button" onClick={() => stop(true)} title="Parar e salvar" className={btn} style={{ borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>⏹ Salvar</button>
            <button type="button" onClick={() => stop(false)} title="Descartar gravação" className={btn} style={{ borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>✕</button>
          </>
        )}
        {busy && <span className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11 }}>salvando…</span>}
      </div>

      {error && <span className="text-red-600 dark:text-red-400" style={{ fontSize: 11 }}>{error}</span>}

      {items.map((a) => <AudioRow key={a.name} cardId={cardId} a={a} onError={setError} />)}
    </div>
  );
}
