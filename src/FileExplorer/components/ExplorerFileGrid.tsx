import type { MouseEvent } from 'react';
import ExplorerThumbnail from './ExplorerThumbnail';
import type { FsEntry } from '../types/fileExplorer.types';

interface ExplorerFileGridProps {
  entries: FsEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onOpen: (entry: FsEntry) => void;
  onContextMenu: (e: MouseEvent, entry: FsEntry) => void;
  thumbnailSize?: number;
}

export default function ExplorerFileGrid({ entries, selectedPath, onSelect, onOpen, onContextMenu, thumbnailSize = 48 }: ExplorerFileGridProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 4, padding: 16 }}>
      {entries.map((entry) => (
        <div
          key={entry.path}
          onClick={() => onSelect(entry.path)}
          onDoubleClick={() => onOpen(entry)}
          onContextMenu={(e) => { e.preventDefault(); onSelect(entry.path); onContextMenu(e, entry); }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: 8,
            borderRadius: 8,
            cursor: 'default',
            textAlign: 'center',
            background: entry.path === selectedPath ? '#e8f0fe' : 'transparent',
          }}
          title={entry.name}
        >
          <ExplorerThumbnail entry={entry} size={thumbnailSize} />
          <span style={{
            fontSize: 12,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {entry.name}
          </span>
        </div>
      ))}
    </div>
  );
}
