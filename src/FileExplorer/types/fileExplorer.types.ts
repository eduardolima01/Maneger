export interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modifiedAt: string | null;
  extension: string | null;
}

export interface QuickAccessLocation {
  label: string;
  path: string;
}

export type SortField = 'name' | 'type' | 'size' | 'date';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'icons' | 'list' | 'columns';

export interface ExplorerPrefs {
  defaultPath: string | null;
  viewMode: ViewMode; // novo
}

export interface BreadcrumbSegment {
  label: string;
  path: string;
}

export interface ClipboardState {
  sourcePath: string;
  sourceName: string;
  mode: 'copy' | 'move';
}

export interface TrashEntry {
  id: string;
  name: string;
  originalParent: string;
  timeDeleted: number;
}
