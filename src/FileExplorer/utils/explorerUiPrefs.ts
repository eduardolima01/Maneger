// Preferências de interface do Explorador que sobrevivem ao fechar o app (tamanho dos ícones).
// Módulo puro: sem React nem Tauri, pra poder ser testado em Node.

export const PREVIEW_MIN = 24;
export const PREVIEW_MAX = 96;
export const PREVIEW_STEP = 4;
export const PREVIEW_DEFAULT = 48;

/** Limita ao intervalo do slider e arredonda pro passo dele (de 4 em 4). */
export function clampPreviewSize(n: number): number {
  if (!Number.isFinite(n)) return PREVIEW_DEFAULT;
  const clamped = Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, n));
  return Math.round(clamped / PREVIEW_STEP) * PREVIEW_STEP;
}

/**
 * Ctrl+scroll: rolar pra cima (deltaY < 0) aumenta, pra baixo diminui. Devolve o tamanho SEM arredondar
 * (o chamador guarda esse valor "quebrado" pra que os deltas pequenos do touchpad se acumulem e só
 * arredonda ao aplicar). Um clique de roda comum (deltaY ≈ 100) vale ~8px.
 */
export function wheelToSize(current: number, deltaY: number): number {
  return Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, current - deltaY * 0.08));
}

export interface ExplorerUiPrefs {
  previewSize: number;
}

/** Tolerante: arquivo ausente ({}), vazio ou corrompido volta ao padrão. */
export function parseUiPrefs(raw: string): ExplorerUiPrefs {
  try {
    const data = JSON.parse(raw);
    const size = typeof data?.previewSize === 'number' ? data.previewSize : PREVIEW_DEFAULT;
    return { previewSize: clampPreviewSize(size) };
  } catch {
    return { previewSize: PREVIEW_DEFAULT };
  }
}

export function serializeUiPrefs(prefs: ExplorerUiPrefs): string {
  return JSON.stringify(prefs, null, 2);
}
