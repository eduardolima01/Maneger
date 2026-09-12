import { formatBytes } from '../utils/formatters';

interface ExplorerStatusBarProps {
  itemCount: number;
  totalSize: number;
}

export default function ExplorerStatusBar({ itemCount, totalSize }: ExplorerStatusBarProps) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '6px 16px',
      borderTop: '1px solid #e0e0e0', fontSize: 12, color: '#666',
    }}>
      <span>{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
      <span>{formatBytes(totalSize)}</span>
    </div>
  );
}
