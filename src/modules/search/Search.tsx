export type SearchCategory =
  | 'navigation' | 'projects' | 'subprojects' | 'kanbans'
  | 'tasks' | 'notes' | 'logs' | 'settings' | 'actions';

export interface SearchResultItem {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle?: string;
  icon: string;
  matchScore: number; // 0 = match perfeito, 1 = pior — vem do Fuse, ajustado por recência/frequência depois
  onSelect: () => void;
}

export interface SearchProvider {
  category: SearchCategory;
  label: string;
  search(query: string): Promise<SearchResultItem[]>;
}

export interface RecentEntry {
  id: string; // mesmo id do SearchResultItem selecionado
  category: SearchCategory;
  title: string;
  subtitle?: string;
  icon: string;
  accessCount: number;
  lastAccessedAt: string;
}
