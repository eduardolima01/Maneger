
import SearchResultRow from './SearchResultRow';
import type { SearchResultItem, SearchCategory, RecentEntry } from '../types/search.types';

const CATEGORY_LABELS: Record<SearchCategory, string> = {
  navigation: 'Páginas', projects: 'Projetos', subprojects: 'Subprojetos',
  kanbans: 'Kanbans', tasks: 'Tasks', notes: 'Notas', logs: 'Logs',
  settings: 'Configurações', actions: 'Comandos',
};

const CATEGORY_ORDER: SearchCategory[] = ['navigation', 'actions', 'projects', 'subprojects', 'kanbans', 'tasks', 'notes', 'logs', 'settings'];

interface SearchResultsProps {
  hasQuery: boolean;
  groupedResults: Map<SearchCategory, SearchResultItem[]>;
  flatResults: SearchResultItem[];
  selectedIndex: number;
  onSelect: (item: SearchResultItem) => void;
  onHover: (flatIndex: number) => void;
  recentEntries: RecentEntry[];
  recentQueries: string[];
  onSelectRecent: (entry: RecentEntry) => void;
  onSelectQuery: (query: string) => void;
}

export default function SearchResults({
  hasQuery, groupedResults, flatResults, selectedIndex, onSelect, onHover,
  recentEntries, recentQueries, onSelectRecent, onSelectQuery,
}: SearchResultsProps) {
  if (!hasQuery) {
    return (
      <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 0' }}>
        {recentQueries.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#999', padding: '4px 16px' }}>Pesquisas recentes</div>
            {recentQueries.map((q) => (
              <div
                key={q}
                onClick={() => onSelectQuery(q)}
                style={{ padding: '6px 16px', fontSize: 13, color: '#555', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                🕑 {q}
              </div>
            ))}
          </div>
        )}

        {recentEntries.length > 0 ? (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#999', padding: '4px 16px' }}>Acessados recentemente</div>
            {recentEntries.map((entry) => (
              <div
                key={`${entry.category}-${entry.id}`}
                onClick={() => onSelectRecent(entry)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: 15 }}>{entry.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</div>
                  {entry.subtitle && <div style={{ fontSize: 11, color: '#999' }}>{entry.subtitle}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 24 }}>Comece a digitar pra pesquisar...</p>
        )}
      </div>
    );
  }

  if (flatResults.length === 0) {
    return <p style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 24 }}>Nenhum resultado encontrado.</p>;
  }

  let runningIndex = 0;

  return (
    <div style={{ maxHeight: 420, overflowY: 'auto', padding: '8px 0' }}>
      {CATEGORY_ORDER.filter((c) => (groupedResults.get(c)?.length ?? 0) > 0).map((category) => {
        const items = groupedResults.get(category)!;
        const startIndex = runningIndex;
        runningIndex += items.length;

        return (
          <div key={category} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#999', padding: '4px 16px' }}>{CATEGORY_LABELS[category]}</div>
            {items.map((item, i) => {
              const flatIndex = startIndex + i;
              return (
                <SearchResultRow
                  key={`${item.category}-${item.id}`}
                  item={item}
                  active={flatIndex === selectedIndex}
                  onClick={() => onSelect(item)}
                  onMouseEnter={() => onHover(flatIndex)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
