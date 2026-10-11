import { formatBytes } from '../utils/formatters';

interface ExplorerStatusBarProps {
  itemCount: number;
  totalSize: number;
}

export default function ExplorerStatusBar({ itemCount, totalSize }: ExplorerStatusBarProps) {
  return (
    <div className="flex justify-between border-t border-zinc-200 px-4 py-1.5 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      <span>{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
      <span>{formatBytes(totalSize)}</span>
    </div>
  );
}