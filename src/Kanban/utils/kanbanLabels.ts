export interface ParsedLabel { name: string; color: string }

const DEFAULT_LABEL_COLOR = '#4338ca';

export function parseLabel(raw: string): ParsedLabel {
  const idx = raw.indexOf('::');
  if (idx === -1) return { name: raw, color: DEFAULT_LABEL_COLOR };
  return { name: raw.slice(0, idx), color: raw.slice(idx + 2) || DEFAULT_LABEL_COLOR };
}

export function serializeLabel(name: string, color: string): string {
  return `${name}::${color}`;
}

export const LABEL_COLOR_PALETTE = [
  '#e53935', '#fb8c00', '#fdd835', '#43a047',
  '#00acc1', '#1e88e5', '#5e35b1', '#8e24aa',
  '#6d4c41', '#546e7a',
];
