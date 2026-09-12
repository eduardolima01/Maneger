import type { MouseEvent } from 'react';
import { getFileIcon } from '../utils/fileIcon';
import { formatBytes, formatModifiedDate } from '../utils/formatters';
import type { FsEntry, SortField, SortDirection } from '../types/fileExplorer.types';
import { MdChevronRight, MdExpandMore } from 'react-icons/md';

interface ExplorerFileListProps {
  entries: FsEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onOpen: (entry: FsEntry) => void;
  onContextMenu: (e: MouseEvent, entry: FsEntry) => void;
  expandedPaths: Set<string>;
  childrenByPath: Record<string, FsEntry[]>;
  childrenLoading: Record<string, boolean>;
  onToggleExpand: (path: string) => void;
}

const COLUMNS: { field: SortField; label: string; width: string }[] = [
  { field: 'name', label: 'Nome', width: '1fr' },
  { field: 'type', label: 'Tipo', width: '100px' },
  { field: 'size', label: 'Tamanho', width: '100px' },
  { field: 'date', label: 'Modificado', width: '160px' },
];

interface TreeRow {
  entry: FsEntry;
  depth: number;
}

function buildTreeRows(
  entries: FsEntry[],
  depth: number,
  expandedPaths: Set<string>,
  childrenByPath: Record<string, FsEntry[]>,
): TreeRow[] {
  const rows: TreeRow[] = [];
  for (const entry of entries) {
    rows.push({ entry, depth });
    if (entry.isDir && expandedPaths.has(entry.path)) {
      rows.push(...buildTreeRows(childrenByPath[entry.path] ?? [], depth + 1, expandedPaths, childrenByPath));
    }
  }
  return rows;
}

export default function ExplorerFileList({
  entries, selectedPath, onSelect, sortField, sortDirection, onSort, onOpen, onContextMenu,
  expandedPaths, childrenByPath, childrenLoading, onToggleExpand,
}: ExplorerFileListProps) {
  const gridTemplate = COLUMNS.map((c) => c.width).join(' ');
  const rows = buildTreeRows(entries, 0, expandedPaths, childrenByPath);

  return (
    <div style={{ padding: '0 8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, padding: '6px 8px', borderBottom: '1px solid #e0e0e0', position: 'sticky', top: 0, background: '#fff' }}>
        {COLUMNS.map((col) => (
          <button
            key={col.field}
            onClick={() => onSort(col.field)}
            style={{
              border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer',
              fontSize: 11, color: '#666', textTransform: 'uppercase', fontWeight: sortField === col.field ? 700 : 400,
              padding: 0,
            }}
          >
            {col.label}{sortField === col.field ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
          </button>
        ))}
      </div>

      {rows.map(({ entry, depth }) => {
        const isExpanded = entry.isDir && expandedPaths.has(entry.path);
        const isLoadingChildren = !!childrenLoading[entry.path];
        return (
          <div
            key={entry.path}
            onClick={() => onSelect(entry.path)}
            onDoubleClick={() => onOpen(entry)}
            onContextMenu={(e) => { e.preventDefault(); onSelect(entry.path); onContextMenu(e, entry); }}
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              alignItems: 'center',
              padding: '6px 8px',
              fontSize: 13,
              borderBottom: '1px solid #f2f2f2',
              cursor: 'default',
              background: entry.path === selectedPath ? '#e8f0fe' : 'transparent',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: depth * 16 }}>
              {entry.isDir ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleExpand(entry.path); }}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#666', flexShrink: 0 }}
                >
                  {isExpanded ? <MdExpandMore size={14} /> : <MdChevronRight size={14} />}
                </button>
              ) : (
                <span style={{ width: 14, flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 16 }}>{getFileIcon(entry)}</span>
              {entry.name}
              {isExpanded && isLoadingChildren && <span style={{ fontSize: 11, color: '#999' }}>(carregando...)</span>}
            </span>
            <span style={{ color: '#666', fontSize: 12 }}>{entry.isDir ? 'Pasta' : (entry.extension ?? '—')}</span>
            <span style={{ color: '#666', fontSize: 12 }}>{entry.isDir ? '—' : formatBytes(entry.size)}</span>
            <span style={{ color: '#666', fontSize: 12 }}>{formatModifiedDate(entry.modifiedAt)}</span>
          </div>
        );
      })}
    </div>
  );
}
