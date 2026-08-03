import type { SearchProvider, SearchResultItem } from '../types/search.types';
import { fuzzySearch } from '../services/fuzzyMatch';
import { openEntityTab } from '@/components/layout/tabs/tabStore';

const SETTINGS_PAGES = [
  { id: 'settings-appearance', title: 'Aparência' },
  { id: 'settings-theme', title: 'Tema' },
  { id: 'settings-database', title: 'Banco de Dados' },
  { id: 'settings-backup', title: 'Backup' },
  { id: 'settings-ai', title: 'IA' },
  { id: 'settings-shortcuts', title: 'Atalhos' },
  { id: 'settings-plugins', title: 'Plugins' },
];

export function createSettingsProvider(navigate: (path: string) => void): SearchProvider {
  return {
    category: 'settings',
    label: 'Configurações',
    async search(query) {
      return fuzzySearch(SETTINGS_PAGES, query, ['title']).map(
        ({ item, score }): SearchResultItem => ({
          id: item.id,
          category: 'settings',
          title: item.title,
          icon: '⚙️',
          matchScore: score,
          onSelect: () => navigate('/settings'),
          onAltSelect: () => openEntityTab('/settings'),
        })
      );
    },
  };
}
