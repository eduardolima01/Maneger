/** Utilitários de cor + opacidade (fundo translúcido de coluna). Todas as cores de entrada são hex: "#rgb" ou "#rrggbb". */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 1));
}

/** Cor com transparência pro CSS: "#336699" + 0.5 → "rgba(51, 102, 153, 0.5)". Hex inválido volta como veio. */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp01(alpha)})`;
}

function toHex2(n: number): string {
  return Math.round(n).toString(16).padStart(2, '0');
}

/**
 * Cor que o OLHO vê quando `hex` com opacidade `alpha` está sobre uma superfície `surfaceHex` (branco no tema claro,
 * cinza escuro no escuro). Serve pra escolher texto legível: com o fundo translúcido, o contraste depende do que
 * está embaixo, não só da cor escolhida. Devolve hex de 7 caracteres.
 */
export function blendOverSurface(hex: string, alpha: number, surfaceHex: string): string {
  const fg = hexToRgb(hex);
  const bg = hexToRgb(surfaceHex);
  if (!fg || !bg) return hex;
  const a = clamp01(alpha);
  return `#${toHex2(fg[0] * a + bg[0] * (1 - a))}${toHex2(fg[1] * a + bg[1] * (1 - a))}${toHex2(fg[2] * a + bg[2] * (1 - a))}`;
}

/** Superfície "de baixo" mais provável do app no tema atual (o fundo claro/escuro do quadro). */
export function currentSurfaceHex(): string {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? '#262626' : '#ffffff';
}
