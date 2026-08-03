import type { SearchProvider, SearchResultItem } from '../types/search.types';
import { fuzzySearch } from '../services/fuzzyMatch';
import { getAllKanbansWithProject } from '@/lib/api/kanban/kanbans';
import { openGlobalKanbanModal } from '@/Kanban/globalKanbanModal';
import { openKanbanTab } from '@/components/layout/tabs/tabStore';

export function createKanbansProvider(): SearchProvider {
  return {
    category: 'kanbans',
    label: 'Kanbans',
    async search(query) {
      const kanbans = await getAllKanbansWithProject();
      return fuzzySearch(kanbans, query, ['name', 'projectName']).map(
        ({ item, score }): SearchResultItem => ({
          id: item.id,
          category: 'kanbans',
          title: item.name,
          subtitle: item.projectName,
          icon: '📋',
          matchScore: score,
          onSelect: () => openGlobalKanbanModal(item),
          onAltSelect: () => openKanbanTab(item.id),
        })
      );
    },
  };
}
