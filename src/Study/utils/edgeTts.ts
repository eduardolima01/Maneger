import { invoke } from '@tauri-apps/api/core';

/**
 * TTS via Microsoft Edge Read Aloud (mesmo motor de vozes neurais do navegador
 * Edge), chamado do lado Rust através da crate `msedge-tts` — NÃO é a lib
 * Python `edge-tts` em si (isso exigiria embutir um interpretador Python no
 * app), mas fala o mesmo protocolo e usa as mesmas vozes.
 *
 * Requer internet: ao contrário da Web Speech API (utils/tts.ts), que usa
 * vozes instaladas no sistema operacional, isso chama o serviço da Microsoft
 * pela rede. Ver SpeakButton.tsx pro fallback automático quando falhar.
 */

export interface EdgeVoice {
  id: string;
  label: string;
}

/** Vozes pt-BR mais comuns do Edge Read Aloud — fixas aqui pra não precisar de
 * uma chamada de rede extra só pra listar vozes disponíveis a cada vez. */
export const EDGE_TTS_VOICES: EdgeVoice[] = [
  { id: 'pt-BR-FranciscaNeural', label: 'Francisca (BR, feminina)' },
  { id: 'pt-BR-AntonioNeural', label: 'Antônio (BR, masculina)' },
  { id: 'pt-BR-BrendaNeural', label: 'Brenda (BR, feminina)' },
  { id: 'pt-BR-DonatoNeural', label: 'Donato (BR, masculina)' },
];

export const DEFAULT_EDGE_VOICE = EDGE_TTS_VOICES[0].id;

/** Pede ao backend Rust pra sintetizar o texto e devolve um data URL (audio/mpeg) pronto pra tocar. */
export async function synthesizeSpeech(text: string, voice: string = DEFAULT_EDGE_VOICE): Promise<string> {
  const base64 = await invoke<string>('synthesize_speech', { text, voice });
  return `data:audio/mpeg;base64,${base64}`;
}
