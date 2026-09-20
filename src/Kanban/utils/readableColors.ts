export interface ReadableTextColors {
  /** Texto principal (nomes, títulos). */
  text: string;
  /** Texto de apoio legível (descrição, contadores, botões de "+ Adicionar"). Contraste mínimo 4,5:1 sempre que possível. */
  secondary: string;
  /** Texto discreto (dicas, alças de arrastar). Contraste mínimo 3:1 sempre que possível. */
  muted: string;
  /** Cor de destaque (item ativo, links). */
  accent: string;
  /** Cor de ação destrutiva (✕, excluir). */
  danger: string;
  isDark: boolean;
}

type RGB = [number, number, number];

const DARK_BASE: RGB = [31, 31, 31];
const LIGHT_BASE: RGB = [255, 255, 255];
const WHITE_BG: RGB = [255, 255, 255];

function parseHex(hex: string | null | undefined): RGB | null {
  if (!hex) return null;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGB, b: RGB): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Suaviza `base` em direção ao fundo (até `wanted`), mas só até onde o contraste ainda passa de `minContrast`. */
function soften(base: RGB, bg: RGB, wanted: number, minContrast: number): string {
  for (let t = wanted; t > 0; t -= 0.05) {
    const candidate = mix(base, bg, t);
    if (contrast(candidate, bg) >= minContrast) return toHex(candidate);
  }
  return toHex(base);
}

/** Primeiro candidato com contraste suficiente; se nenhum passar, o de maior contraste. */
function pickAccessible(bg: RGB, candidates: string[], minContrast: number): string {
  let best = candidates[0];
  let bestRatio = 0;
  for (const c of candidates) {
    const rgb = parseHex(c)!;
    const ratio = contrast(rgb, bg);
    if (ratio >= minContrast) return c;
    if (ratio > bestRatio) { best = c; bestRatio = ratio; }
  }
  return best;
}

/**
 * Cores de texto legíveis sobre `backgroundHex`. Escolhe texto claro ou escuro pelo contraste real (WCAG),
 * não por um limite fixo de "claro/escuro". Cor inválida ou ausente é tratada como branco.
 */
export function readableTextColors(backgroundHex: string | null | undefined): ReadableTextColors {
  const bg = parseHex(backgroundHex) ?? WHITE_BG;
  const isDark = contrast(LIGHT_BASE, bg) > contrast(DARK_BASE, bg);
  const base = isDark ? LIGHT_BASE : DARK_BASE;

  return {
    text: toHex(base),
    secondary: soften(base, bg, 0.3, 4.5),
    muted: soften(base, bg, 0.5, 3),
    accent: pickAccessible(bg, ['#1a73e8', '#0b57d0', '#062e6f', '#8ab4f8', '#c2e7ff'], 4.5),
    danger: pickAccessible(bg, ['#c62828', '#8e0000', '#ff8a80', '#ffcdd2'], 4.5),
    isDark,
  };
}
