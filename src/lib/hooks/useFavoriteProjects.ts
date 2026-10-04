import { useState, useCallback, useEffect } from 'react';
import { readFavoriteIds, writeFavoriteIds, FAVORITES_EVENT } from '@/lib/utils/favorites';

export function useFavoriteProjects() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readFavoriteIds());

  useEffect(() => {
    const sync = () => setFavoriteIds(readFavoriteIds());
    window.addEventListener(FAVORITES_EVENT, sync);
    return () => window.removeEventListener(FAVORITES_EVENT, sync);
  }, []);

  const isFavorite = useCallback((id: string) => favoriteIds.includes(id), [favoriteIds]);

  const toggleFavorite = useCallback((id: string) => {
    const current = readFavoriteIds();
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    writeFavoriteIds(next); // já dispara o evento; todas as instâncias se atualizam
  }, []);

  return { favoriteIds, isFavorite, toggleFavorite };
}
