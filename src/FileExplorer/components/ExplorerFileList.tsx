import type { MouseEvent } from 'react';
import { formatBytes, formatModifiedDate } from '../utils/formatters';
import type { FsEntry, SortField, SortDirection } from '../types/fileExplorer.types';
import { MdChevronRight, MdExpandMore } from 'react-icons/md';
import ExplorerThumbnail from './ExplorerThumbnail';

interface ExplorerFileListProps {
  entries: FsEntry[];
  selectedPaths: Set<string>;
  onSelect: (entry: FsEntry, event: MouseEvent) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onOpen: (entry: FsEntry) => void;
  onContextMenu: (e: MouseEvent, entry: FsEntry) => void;
  expandedPaths: Set<string>;
  childrenByPath: Record<string, FsEntry[]>;
  childrenLoading: Record<string, boolean>;
  onToggleExpand: (path: string) => void;
  /** Mesmo tamanho de preview usado nas colunas/ícones (slider do usuário), pra manter consistência entre modos. */
  thumbnailSize: number;
  /** path da pasta -> path absoluto do ícone customizado, vindo do Store. */
  folderIcons: Record<string, string>;
  /** Arrastar pra selecionar: mousedown sem modificadores num item arma o início do arraste. */
  onSelectDragStart: (entry: FsEntry) => void;
  /** Enquanto arrastando, sobrevoar outro item estende a seleção até ele. */
  onSelectDragOver: (entry: FsEntry) => void;
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
  entries, selectedPaths, onSelect, sortField, sortDirection, onSort, onOpen, onContextMenu,
  expandedPaths, childrenByPath, childrenLoading, onToggleExpand, thumbnailSize, folderIcons,
  onSelectDragStart, onSelectDragOver,
}: ExplorerFileListProps) {
  const gridTemplate = COLUMNS.map((c) => c.width).join(' ');
  const rows = buildTreeRows(entries, 0, expandedPaths, childrenByPath);

  return (
    <div className="px-2">
      <div
        data-no-marquee
        className="sticky top-0 grid border-b border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {COLUMNS.map((col) => (
          <button
            key={col.field}
            onClick={() => onSort(col.field)}
            className={`cursor-pointer border-none bg-transparent p-0 text-left text-[11px] uppercase text-zinc-500 dark:text-zinc-400 ${
              sortField === col.field ? 'font-bold' : 'font-normal'
            }`}
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
            className={`grid cursor-default items-center border-b border-zinc-100 px-2 py-1.5 text-[13px] dark:border-zinc-800 ${
              selectedPaths.has(entry.path) ? 'bg-blue-100 dark:bg-blue-500/25' : ''
            }`}
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <span className="flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap" style={{ paddingLeft: depth * 16 }}>
              {entry.isDir ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleExpand(entry.path); }}
                  className="flex shrink-0 cursor-pointer border-none bg-transparent p-0 text-zinc-500 dark:text-zinc-400"
                >
                  {isExpanded ? <MdExpandMore size={14} /> : <MdChevronRight size={14} />}
                </button>
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              <span className="flex shrink-0">
                <ExplorerThumbnail
                  entry={entry}
                  size={thumbnailSize}
                  customIconPath={entry.isDir ? folderIcons[entry.path] : undefined}
                />
              </span>
              {entry.name}
              {isExpanded && isLoadingChildren && <span className="text-[11px] text-zinc-400">(carregando...)</span>}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{entry.isDir ? 'Pasta' : (entry.extension ?? '—')}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{entry.isDir ? '—' : formatBytes(entry.size)}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatModifiedDate(entry.modifiedAt)}</span>
          </div>
        );
      })}
    </div>
  );
}