const STORAGE_KEY = 'maneger:favoriteProjectIds';
export const FAVORITES_EVENT = 'favorites-changed';

export function readFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeFavoriteIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage indisponível (ex: contexto restrito) — falha silenciosa, favoritos não persistem nessa sessão
  }
  // avisa todas as instâncias de useFavoriteProjects (barra de fixados, cards, botão da aba...)
  window.dispatchEvent(new Event(FAVORITES_EVENT));
}
