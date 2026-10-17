/**
 * Efeitos sonoros curtos gerados na hora (Web Audio) — sem arquivos de som.
 * Cada evento tem um timbre/direção diferente pra dar pra distinguir de ouvido:
 *  - início  : dois bips subindo (grave → agudo)
 *  - fim     : dois bips descendo (agudo → grave)
 *  - descarte: um tom grave e curto
 *  - pronto  : acorde suave (transcrição concluída)
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, peak: number): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function play(notes: Array<[number, number, number, OscillatorType, number]>, totalMs: number): Promise<void> {
  const c = getCtx();
  if (!c) return Promise.resolve();
  const t0 = c.currentTime + 0.01;
  for (const [freq, offset, dur, type, peak] of notes) tone(c, freq, t0 + offset, dur, type, peak);
  return new Promise((resolve) => window.setTimeout(resolve, totalMs));
}

/** Resolve só quando o som acabou — espere antes de começar a gravar pra o bip não entrar na gravação. */
export function playStartSound(): Promise<void> {
  return play([[660, 0, 0.09, 'sine', 0.22], [990, 0.11, 0.12, 'sine', 0.22]], 290);
}

export function playStopSound(): Promise<void> {
  return play([[880, 0, 0.09, 'triangle', 0.22], [494, 0.11, 0.16, 'triangle', 0.22]], 320);
}

export function playDiscardSound(): Promise<void> {
  return play([[196, 0, 0.22, 'sawtooth', 0.12]], 240);
}

export function playDoneSound(): Promise<void> {
  return play([[784, 0, 0.35, 'sine', 0.14], [1047, 0.05, 0.4, 'sine', 0.12], [1319, 0.1, 0.45, 'sine', 0.1]], 560);
}
