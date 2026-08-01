import { createPortal } from 'react-dom';
import SearchInput from './SearchInput';
import SearchResults from './SearchResults';
import { recordAccess } from '../services/recentSearchService';
import type { RecentEntry } from '../types/search.types';
import { useGlobalSearch } from '../providers/useGlobalSearch';

interface SearchOverlayProps {
  open: boolean;
  focusToken: number;
  onClose: () => void;
  resolveRecentAction: (entry: RecentEntry) => (() => void) | null;
}

export default function SearchOverlay({ open, focusToken, onClose, resolveRecentAction }: SearchOverlayProps) {
  const search = useGlobalSearch();

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); search.moveSelection(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); search.moveSelection(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); search.confirmSelection(); handleAfterSelect(); }
  }

  function handleAfterSelect() {
    onClose();
    search.reset();
  }

  function handleSelectRecent(entry: RecentEntry) {
    const action = resolveRecentAction(entry);
    if (action) {
      recordAccess(entry);
      action();
    }
    handleAfterSelect();
  }

  function handleSelectQuery(query: string) {
    search.setQuery(query);
  }

  if (!open) return null;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 2147483645 }} />

      <div
        style={{
          position: 'fixed', top: '15vh', left: '50%', transform: 'translateX(-50%)',
          width: 560, maxWidth: 'calc(100vw - 48px)', maxHeight: '65vh',
          backgroundColor: '#fff', borderRadius: 12, boxShadow: '0 16px 50px rgba(0,0,0,0.3)',
          zIndex: 2147483646, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        <SearchInput value={search.query} onChange={search.setQuery} onKeyDown={handleKeyDown} focusToken={focusToken} loading={search.loading} />
        <SearchResults
          hasQuery={!!search.query.trim()}
          groupedResults={search.groupedResults}
          flatResults={search.results}
          selectedIndex={search.selectedIndex}
          onSelect={(item) => { search.selectResult(item); handleAfterSelect(); }}
          onHover={() => { }}
          recentEntries={search.recentEntries}
          recentQueries={search.recentQueries}
          onSelectRecent={handleSelectRecent}
          onSelectQuery={handleSelectQuery}
        />
      </div>
    </>,
    document.body
  );
}

