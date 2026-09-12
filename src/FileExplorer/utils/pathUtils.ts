import type { BreadcrumbSegment } from '../types/fileExplorer.types';

/**
 * Quebra um path absoluto em segmentos clicáveis de breadcrumb.
 * Lida com separador Windows ("C:\Users\...") e Unix ("/home/...").
 * Validado manualmente com casos dos dois formatos antes de entrar no módulo.
 */
export function getBreadcrumbSegments(path: string): BreadcrumbSegment[] {
  const sep = path.includes('\\') ? '\\' : '/';
  const normalized = path.replace(/[\\/]+$/, '');
  const parts = normalized.split(sep).filter(Boolean);

  const segments: BreadcrumbSegment[] = [];
  let acc = sep === '\\' ? '' : sep;

  for (const part of parts) {
    if (sep === '\\' && acc === '') {
      acc = `${part}\\`; // "C:\"
    } else {
      acc = acc.endsWith(sep) ? `${acc}${part}` : `${acc}${sep}${part}`;
    }
    segments.push({ label: part, path: acc });
  }
  return segments;
}

export function getParentPath(path: string): string {
  const segments = getBreadcrumbSegments(path);
  if (segments.length <= 1) return segments[0]?.path ?? path;
  return segments[segments.length - 2].path;
}
