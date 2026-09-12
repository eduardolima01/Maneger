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
}

export default function ExplorerThumbnail({ entry, size = 64 }: ExplorerThumbnailProps) {
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
    else el.play().catch(() => {});
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
        style={{ width: size, height: size, objectFit: 'cover', borderRadius: 6 }}
      />
    );
  }

  // vídeo ou áudio: preview + ícone de play flutuante + barra de progresso (aparece após o 1º play)
  return (
    <div
      style={{
        position: 'relative', width: size, height: size, borderRadius: 6, overflow: 'hidden',
        background: '#e8e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {kind === 'video' ? (
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
        style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 28, height: 28, borderRadius: '50%', border: 'none',
          background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
        }}
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
          style={{
            position: 'absolute', bottom: 2, left: 2, right: 2, width: 'calc(100% - 4px)',
            height: 4, margin: 0, cursor: 'pointer', accentColor: '#1a73e8', zIndex: 1,
          }}
        />
      )}
    </div>
  );
}
