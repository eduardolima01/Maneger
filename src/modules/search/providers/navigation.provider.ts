import type { SearchProvider, SearchResultItem } from '../types/search.types';
import { NAVIGATION_ITEMS } from '../indexers/navigationIndexer';
import { fuzzySearch } from '../services/fuzzyMatch';

export function createNavigationProvider(navigate: (path: string) => void): SearchProvider {
  return {
    category: 'navigation',
    label: 'Páginas',
    async search(query) {
      return fuzzySearch(NAVIGATION_ITEMS, query, ['title']).map(
        ({ item, score }): SearchResultItem => ({
          id: item.id,
          category: 'navigation',
          title: item.title,
          icon: item.icon,
          matchScore: score,
          onSelect: () => navigate(item.path),
        })
      );
    },
  };
}
