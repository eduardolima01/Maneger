const STORAGE_KEY = 'maneger:favoriteProjectIds';

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
}
