import { useEffect, useRef, useState } from 'react';
import { synthesizeSpeech, DEFAULT_EDGE_VOICE } from '../utils/edgeTts';
import { isTtsSupported as isBrowserTtsSupported, speak as browserSpeak, stopSpeaking as stopBrowserSpeaking } from '../utils/tts';

interface SpeakButtonProps {
  text: string;
  label?: string;
  voice?: string;
}

type Status = 'idle' | 'loading' | 'playing' | 'error';

/**
 * Botão "🔊 Ouvir". Tenta primeiro o edge-tts (voz neural, via backend Rust —
 * ver utils/edgeTts.ts), e cai pra Web Speech API do navegador (utils/tts.ts)
 * se a chamada falhar (offline, comando ainda não registrado no lib.rs, etc).
 * Se nem isso tiver suporte no ambiente, não renderiza nada.
 */
export default function SpeakButton({ text, label = 'Ouvir', voice = DEFAULT_EDGE_VOICE }: SpeakButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAll = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    stopBrowserSpeaking();
  };

  // Se o card muda ou o componente some da tela, corta a fala/áudio em andamento.
  useEffect(() => () => stopAll(), []);

  if (!text.trim()) return null;

  const playViaBrowserFallback = () => {
    if (!isBrowserTtsSupported()) {
      setStatus('idle');
      return;
    }
    setStatus('playing');
    browserSpeak(text, { onEnd: () => setStatus('idle') });
  };

  const handleClick = async () => {
    if (status === 'playing' || status === 'loading') {
      stopAll();
      setStatus('idle');
      return;
    }

    setStatus('loading');
    try {
      const dataUrl = await synthesizeSpeech(text, voice);
      const audio = new Audio(dataUrl);
      audioRef.current = audio;
      audio.onended = () => setStatus('idle');
      audio.onerror = () => playViaBrowserFallback();
      await audio.play();
      setStatus('playing');
    } catch {
      // Offline, comando ainda não existe no backend, etc — cai pra voz do navegador.
      playViaBrowserFallback();
    }
  };

  const icon = status === 'loading' ? '⏳' : status === 'playing' ? '⏹' : '🔊';
  const statusLabel = status === 'loading' ? 'Carregando...' : status === 'playing' ? 'Parar' : label;

  return (
    <button
      onClick={handleClick}
      title={statusLabel}
      disabled={status === 'loading'}
      style={{
        border: '1px solid #ddd',
        background: status === 'playing' ? '#eef4ff' : '#fff',
        borderRadius: 6,
        cursor: status === 'loading' ? 'wait' : 'pointer',
        fontSize: 12,
        padding: '4px 10px',
        color: '#444',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
      }}
    >
      {icon}{label ? ` ${statusLabel}` : ''}
    </button>
  );
}
