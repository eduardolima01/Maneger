import type { SearchProvider, SearchResultItem } from '../types/search.types';
import { getAllLogGroupsForSearch } from '@/lib/api/logGroups';
import { fuzzySearch } from '../services/fuzzyMatch';

export function createLogsProvider(navigate: (path: string) => void): SearchProvider {
  return {
    category: 'logs',
    label: 'Logs',
    async search(query) {
      const groups = await getAllLogGroupsForSearch();
      return fuzzySearch(groups, query, ['name', 'templateName']).map(
        ({ item, score }): SearchResultItem => ({
          id: item.id,
          category: 'logs',
          title: item.name,
          subtitle: item.templateName,
          icon: '📊',
          matchScore: score,
          onSelect: () => navigate(`/projects/${item.projectId}`),
        })
      );
    },
  };
}

