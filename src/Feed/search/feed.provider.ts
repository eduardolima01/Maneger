import type { SearchProvider, SearchResultItem } from '@/modules/search/types/search.types'; // TODO: confirmar caminho real
import { fuzzySearch } from '@/modules/search/services/fuzzyMatch'; // TODO: confirmar caminho real
import { loadFeedData } from '../api/feed';
import type { Moment } from '../types/feed.types';

interface SearchableMoment extends Moment {
  projectName: string;
  tagsJoined: string;
}

export function createFeedProvider(navigate: (path: string) => void): SearchProvider {
  return {
    category: 'feed',
    label: 'Momentos',
    async search(query) {
      const data = await loadFeedData();
      // busca por content/tags/data — projectName fica vazio aqui (resolver nome de projeto exigiria
      // outra chamada; se quiser título com nome do projeto, dá pra enriquecer depois com useProjects)
      const searchable: SearchableMoment[] = data.moments.map((m) => ({
        ...m,
        projectName: '',
        tagsJoined: m.tags.join(' '),
      }));

      return fuzzySearch(searchable, query, ['content', 'tagsJoined']).map(
        ({ item, score }): SearchResultItem => ({
          id: item.id,
          category: 'feed',
          title: item.content.slice(0, 80),
          subtitle: new Date(item.occurredAt).toLocaleDateString('pt-BR'),
          icon: '🕓',
          matchScore: score,
          onSelect: () => navigate(`/feed?momentId=${item.id}`),
        })
      );
    },
  };
}
