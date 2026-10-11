import { useRef, useState, useEffect, type MouseEvent, type ChangeEvent } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { MdPlayArrow, MdPause } from 'react-icons/md';
import { getFileIcon } from '../utils/fileIcon';
import { getMediaKind } from '../utils/mediaType';
import { registerPlayback, unregisterPlayback } from '../utils/mediaPlaybackCoordinator';
import type { FsEntry } from '../types/fileExplorer.types';

interface ExplorerThumbnailProps {
  entry: FsEntry;
  /** Tamanho do quadrado da thumbnail em px (fallback de emoji usa ~60% disso como fontSize). */
  size?: number;
  /**
   * Path absoluto (no disco, fora da pasta do usuário) de um ícone customizado pra essa pasta,
   * vindo de `folderIcons[entry.path]` no Store. Só faz sentido pra `entry.isDir`; ignorado
   * pra arquivos (que já têm preview real de imagem/vídeo/áudio via `kind`).
   */
  customIconPath?: string;
}

export default function ExplorerThumbnail({ entry, size = 64, customIconPath }: ExplorerThumbnailProps) {
  const kind = getMediaKind(entry);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false); // já deu play alguma vez -> barra fica visível mesmo pausado
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const getEl = () => (kind === 'video' ? videoRef.current : audioRef.current);

  // Se o card desmontar (ex: navegou de pasta) enquanto tocava, libera o "dono" do coordenador
  useEffect(() => {
    return () => {
      const el = getEl();
      if (el) unregisterPlayback(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (entry.isDir && customIconPath) {
    return (
      <img
        src={convertFileSrc(customIconPath)}
        alt={entry.name}
        loading="lazy"
        className="rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  if (!kind) {
    return <span style={{ fontSize: Math.round(size * 0.6), lineHeight: 1 }}>{getFileIcon(entry)}</span>;
  }

  const src = convertFileSrc(entry.path);

  const handlePlay = () => {
    const el = getEl();
    if (el) registerPlayback(el); // pausa qualquer outra mídia tocando no momento
    setPlaying(true);
    setStarted(true);
  };

  const handlePause = () => setPlaying(false);

  const togglePlay = (e: MouseEvent) => {
    e.stopPropagation(); // não deixa o clique no play disparar seleção/duplo-clique do item
    const el = getEl();
    if (!el) return;
    if (playing) el.pause();
    else el.play().catch(() => { });
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const el = getEl();
    const value = Number(e.target.value);
    if (el) el.currentTime = value;
    setCurrentTime(value);
  };

  if (kind === 'image') {
    return (
      <img
        src={src}
        alt={entry.name}
        loading="lazy"
        className="rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  // vídeo ou áudio: preview + ícone de play flutuante + barra de progresso (aparece após o 1º play)
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-700"
      style={{ width: size, height: size }}
    >
      {kind === 'video' ? (
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          className="h-full w-full object-cover"
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handlePause}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        />
      ) : (
        <>
          <span style={{ fontSize: Math.round(size * 0.4) }}>🎵</span>
          <audio
            ref={audioRef}
            src={src}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handlePause}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          />
        </>
      )}

      <button
        onClick={togglePlay}
        title={playing ? 'Pausar' : 'Reproduzir'}
        className="absolute left-1/2 top-1/2 z-[1] flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-black/[0.55] text-white"
      >
        {playing ? <MdPause size={16} /> : <MdPlayArrow size={16} />}
      </button>

      {started && duration > 0 && (
        <input
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          title="Navegar na linha do tempo"
          className="absolute bottom-0.5 left-0.5 right-0.5 z-[1] m-0 h-1 w-[calc(100%-4px)] cursor-pointer accent-blue-600 dark:accent-blue-400"
        />
      )}
    </div>
  );
}