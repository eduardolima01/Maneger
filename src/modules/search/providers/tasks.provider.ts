import type { SearchProvider, SearchResultItem } from '../types/search.types';
import { getAllTasksForSearch } from '@/lib/api/tasks';
import { fuzzySearch } from '../services/fuzzyMatch';

export function createTasksProvider(navigate: (path: string) => void): SearchProvider {
  return {
    category: 'tasks',
    label: 'Tasks',
    async search(query) {
      const tasks = await getAllTasksForSearch();
      return fuzzySearch(tasks, query, ['title', 'description']).map(
        ({ item, score }): SearchResultItem => ({
          id: item.id,
          category: 'tasks',
          title: item.title,
          icon: '✅',
          matchScore: score,
          // task não tem rota própria — leva pro projeto dono; achar/selecionar a task específica
          // dentro da página fica pendente (precisaria de um query param tipo ?taskId=)
          onSelect: () => navigate(`/projects/${item.projectId}`),
        })
      );
    },
  };
}
