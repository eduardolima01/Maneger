import type { SearchProvider, SearchResultItem } from '../types/search.types';
import { ACTION_ITEMS } from '../indexers/actionsIndexer';
import { fuzzySearch } from '../services/fuzzyMatch';

export function createActionsProvider(navigate: (path: string) => void): SearchProvider {
  return {
    category: 'actions',
    label: 'Comandos',
    async search(query) {
      return fuzzySearch(ACTION_ITEMS, query, ['title']).map(
        ({ item, score }): SearchResultItem => ({
          id: item.id,
          category: 'actions',
          title: item.title,
          icon: item.icon,
          matchScore: score,
          onSelect: () => navigate(item.path),
        })
      );
    },
  };
}
