import { useState, useCallback } from 'react';
import { readFavoriteIds, writeFavoriteIds } from '@/lib/utils/favorites';

export function useFavoriteProjects() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readFavoriteIds());

  const isFavorite = useCallback((id: string) => favoriteIds.includes(id), [favoriteIds]);

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      writeFavoriteIds(next);
      return next;
    });
  }, []);

  return { favoriteIds, isFavorite, toggleFavorite };
}
