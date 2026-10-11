import type { MouseEvent } from 'react';
import ExplorerThumbnail from './ExplorerThumbnail';
import type { FsEntry } from '../types/fileExplorer.types';

interface ExplorerFileGridProps {
  entries: FsEntry[];
  selectedPaths: Set<string>;
  onSelect: (entry: FsEntry, event: MouseEvent) => void;
  onOpen: (entry: FsEntry) => void;
  onContextMenu: (e: MouseEvent, entry: FsEntry) => void;
  thumbnailSize?: number;
  /** path da pasta -> path absoluto do ícone customizado, vindo do Store. */
  folderIcons: Record<string, string>;
  /** Arrastar pra selecionar: mousedown sem modificadores num item arma o início do arraste. */
  onSelectDragStart: (entry: FsEntry) => void;
  /** Enquanto arrastando, sobrevoar outro item estende a seleção até ele. */
  onSelectDragOver: (entry: FsEntry) => void;
}

export default function ExplorerFileGrid({ entries, selectedPaths, onSelect, onOpen, onContextMenu, thumbnailSize = 48, folderIcons, onSelectDragStart, onSelectDragOver }: ExplorerFileGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1 p-4">
      {entries.map((entry) => (
        <div
          key={entry.path}
          data-entry-path={entry.path}
          data-drop-path={entry.isDir ? entry.path : undefined}
          onClick={(e) => { e.preventDefault(); onSelect(entry, e); }}
          onMouseDown={(e) => {
            if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
              e.preventDefault(); // evita a seleção de texto nativa do navegador durante o arraste
              onSelectDragStart(entry);
            }
          }}
          onMouseEnter={() => onSelectDragOver(entry)}
          onDoubleClick={() => onOpen(entry)}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, entry); }}
          className={`flex cursor-default flex-col items-center gap-1 rounded-lg p-2 text-center ${
            selectedPaths.has(entry.path) ? 'bg-blue-100 dark:bg-blue-500/25' : ''
          }`}
          title={entry.name}
        >
          <ExplorerThumbnail
            entry={entry}
            size={thumbnailSize}
            customIconPath={entry.isDir ? folderIcons[entry.path] : undefined}
          />
          <span className="max-w-full truncate text-xs">
            {entry.name}
          </span>
        </div>
      ))}
    </div>
  );
}