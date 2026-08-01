import type { SearchResultItem } from '../types/search.types';

interface SearchResultRowProps {
  item: SearchResultItem;
  active: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

export default function SearchResultRow({ item, active, onClick, onMouseEnter }: SearchResultRowProps) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer',
        backgroundColor: active ? '#f0f4ff' : 'transparent',
      }}
    >
      <span style={{ fontSize: 15 }}>{item.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
        {item.subtitle && <div style={{ fontSize: 11, color: '#999' }}>{item.subtitle}</div>}
      </div>
      {active && <kbd style={{ fontSize: 10, color: '#1a73e8', border: '1px solid #c7d7fb', borderRadius: 4, padding: '2px 5px' }}>↵</kbd>}
    </div>
  );
}

