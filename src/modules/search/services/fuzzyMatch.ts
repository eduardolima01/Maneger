import Fuse from 'fuse.js';

export interface FuzzyCandidate<T> {
  item: T;
  score: number; // 0 = perfeito, 1 = pior
}

export function fuzzySearch<T>(items: T[], query: string, keys: string[], limit = 8): FuzzyCandidate<T>[] {
  if (!query.trim()) return [];
  const fuse = new Fuse(items, {
    keys,
    threshold: 0.4, // permite erros de digitação tipo "mnger" → "Manager" sem ficar frouxo demais
    ignoreLocation: true,
    includeScore: true,
  });
  return fuse
    .search(query)
    .slice(0, limit)
    .map((r) => ({ item: r.item, score: r.score ?? 1 }));
}

