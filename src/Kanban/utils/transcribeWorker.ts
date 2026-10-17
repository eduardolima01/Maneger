/// <reference lib="webworker" />
import { pipeline, env } from '@huggingface/transformers';

/**
 * Whisper rodando 100% local (WASM) dentro de um Worker, pra não travar a interface.
 * O modelo é baixado UMA vez (Hugging Face) e fica no cache do WebView — depois funciona offline.
 */
const MODEL = 'Xenova/whisper-base';

env.allowLocalModels = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let asr: any = null;
let currentId = 0;

async function getAsr() {
  if (!asr) {
    asr = await pipeline('automatic-speech-recognition', MODEL, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress_callback: (p: any) => self.postMessage({ id: currentId, type: 'progress', p }),
    });
  }
  return asr;
}

self.onmessage = async (e: MessageEvent<{ id: number; audio: Float32Array; language: string }>) => {
  const { id, audio, language } = e.data;
  currentId = id;
  try {
    const a = await getAsr();
    const out = await a(audio, { language, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
    const text = Array.isArray(out) ? out.map((o: { text: string }) => o.text).join(' ') : (out as { text: string }).text;
    self.postMessage({ id, type: 'result', text });
  } catch (err) {
    self.postMessage({ id, type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
