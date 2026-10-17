import { useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listCardFiles, deleteCardFile } from '@/Kanban/api/kanbanCardAssets';
import { saveBytesInCard, notifyCardMediaChanged, onCardMediaChanged, fmtDuration } from '@/Kanban/utils/cardMedia';
import { playStartSound, playStopSound, playDiscardSound } from '@/Kanban/utils/sounds';

/**
 * Gravação de tela salva no card: botão "🖥 Gravar tela" → escolhe a tela/janela → ⏹ Parar.
 * O vídeo vira o arquivo `tela-<timestamp>-<segundos>s.webm` em `card-files/{cardId}/` (aparece também em "Arquivos").
 * Sem áudio (só a imagem). Limite de 5 min por gravação, porque os bytes passam pelo IPC do Tauri.
 */
interface VideoItem { name: string; path: string; ts: number; secs: number }

const NAME_RE = /^tela-(\d+)-(\d+)s\.(webm|mp4)$/i;
const MAX_SECS = 300;

function useVideos(cardId: string): VideoItem[] {
  const [items, setItems] = useState<VideoItem[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const files = await listCardFiles(cardId);
        const list: VideoItem[] = [];
        for (const f of files) {
          const m = NAME_RE.exec(f.name);
          if (m) list.push({ name: f.name, path: f.path, ts: Number(m[1]), secs: Number(m[2]) });
        }
        list.sort((a, b) => a.ts - b.ts);
        if (alive) setItems(list);
      } catch { if (alive) setItems([]); }
    };
    void load();
    const off = onCardMediaChanged(cardId, () => void load());
    return () => { alive = false; off(); };
  }, [cardId]);
  return items;
}

export default function CardScreenRecord({ cardId }: { cardId: string }) {
  const videos = useVideos(cardId);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const cancelRef = useRef(false);

  useEffect(() => () => {
    cancelRef.current = true;
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); } catch { /* ignora */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      const s = Math.round((Date.now() - startedRef.current) / 1000);
      setElapsed(s);
      if (s >= MAX_SECS) stop(true);
    }, 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      setError('Este ambiente não suporta gravação de tela.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      streamRef.current = stream;
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) ?? '';
      const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 1_200_000 });
      chunksRef.current = [];
      cancelRef.current = false;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setRecording(false);
        const secs = Math.max(1, Math.round((Date.now() - startedRef.current) / 1000));
        if (cancelRef.current) { chunksRef.current = []; return; }
        void persist(new Blob(chunksRef.current, { type: 'video/webm' }), secs);
      };
      // o usuário pode encerrar pelo controle do próprio sistema ("Parar compartilhamento")
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (recRef.current?.state === 'recording') stop(true); });
      recRef.current = rec;
      await playStartSound();
      startedRef.current = Date.now();
      setElapsed(0);
      rec.start(1000);
      setRecording(true);
    } catch (e) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const msg = e instanceof Error ? e.message : String(e);
      setError(/denied|NotAllowed|Permission|cancel/i.test(msg) ? 'Gravação de tela cancelada ou sem permissão.' : `Não foi possível gravar a tela: ${msg}`);
    }
  }

  function stop(save: boolean) {
    cancelRef.current = !save;
    try { recRef.current?.stop(); } catch { /* já parado */ }
    void (save ? playStopSound() : playDiscardSound());
  }

  async function persist(blob: Blob, secs: number) {
    setBusy(true);
    try {
      const name = `tela-${Date.now()}-${secs}s.webm`;
      await saveBytesInCard(cardId, new Uint8Array(await blob.arrayBuffer()), 'webm', name);
      notifyCardMediaChanged(cardId);
    } catch (e) {
      setError(`Falha ao salvar a gravação: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  }

  async function remove(v: VideoItem) {
    try { await deleteCardFile(cardId, v.name); notifyCardMediaChanged(cardId); }
    catch (e) { setError(`Falha ao apagar a gravação: ${e instanceof Error ? e.message : String(e)}`); }
  }

  const btn = 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 bg-transparent cursor-pointer';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} onKeyDown={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {!recording ? (
          <button type="button" disabled={busy} onClick={() => void start()} title="Gravar a tela e salvar neste card" className={btn} style={{ borderRadius: 4, padding: '2px 8px', fontSize: 12, opacity: busy ? 0.5 : 1 }}>
            🖥 Gravar tela
          </button>
        ) : (
          <>
            <span className="text-red-600 dark:text-red-400" style={{ fontSize: 12, fontWeight: 600 }}>● {fmtDuration(elapsed)}</span>
            <button type="button" onClick={() => stop(true)} title="Parar e salvar no card" className={btn} style={{ borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>⏹ Parar</button>
            <button type="button" onClick={() => stop(false)} title="Descartar gravação" className={btn} style={{ borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>✕</button>
          </>
        )}
        {busy && <span className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11 }}>salvando…</span>}
      </div>

      {error && <span className="text-red-600 dark:text-red-400" style={{ fontSize: 11 }}>{error}</span>}

      {videos.map((v) => (
        <div key={v.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <video controls preload="metadata" src={convertFileSrc(v.path)} style={{ width: '100%', maxWidth: 360, borderRadius: 4, background: '#000' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, whiteSpace: 'nowrap' }} title={new Date(v.ts).toLocaleString()}>{fmtDuration(v.secs)}</span>
            <button type="button" onClick={() => void remove(v)} title="Apagar gravação" aria-label="Apagar gravação" className="text-neutral-400 hover:text-red-600 dark:hover:text-red-400 bg-transparent border-0 cursor-pointer" style={{ fontSize: 12 }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
