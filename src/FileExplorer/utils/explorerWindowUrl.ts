// URL da janela separada do Explorador e leitura da pasta inicial passada nela.
// Módulo puro: sem React nem Tauri, pra poder ser testado em Node.
//
// A janela abre em `/?explorerWindow=1` (query na raiz, igual o padrão da janela do modo trabalho): não
// depende de rota nova nem do fallback de SPA do Tauri, e o main.tsx decide o que montar antes do router.

export const EXPLORER_WINDOW_PARAM = 'explorerWindow';

export function buildExplorerWindowUrl(path?: string | null): string {
  const params = new URLSearchParams({ [EXPLORER_WINDOW_PARAM]: '1' });
  if (path) params.set('path', path);
  return `/?${params.toString()}`;
}

/** true se a janela atual foi aberta como Explorador separado. */
export function isExplorerWindow(search: string): boolean {
  return new URLSearchParams(search).get(EXPLORER_WINDOW_PARAM) === '1';
}

/** Pasta inicial passada na URL (`?path=`); null se não houver (janela normal do app). */
export function readInitialPath(search: string): string | null {
  return new URLSearchParams(search).get('path') || null;
}
