import type { SearchProvider, SearchResultItem } from '../types/search.types';
import { getAllNotesForSearch } from '@/lib/api/notes';
import { fuzzySearch } from '../services/fuzzyMatch';

export function createNotesProvider(navigate: (path: string) => void): SearchProvider {
  return {
    category: 'notes',
    label: 'Notas',
    async search(query) {
      const notes = await getAllNotesForSearch();
      return fuzzySearch(notes, query, ['title', 'content']).map(
        ({ item, score }): SearchResultItem => ({
          id: item.id,
          category: 'notes',
          title: item.title || '(sem título)',
          icon: '📝',
          matchScore: score,
          onSelect: () => navigate(`/projects/${item.projectId}`),
        })
      );
    },
  };
}
