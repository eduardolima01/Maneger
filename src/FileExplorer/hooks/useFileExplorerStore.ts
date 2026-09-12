import { useState, useEffect, useCallback, useMemo } from 'react';
import { openPath as openWithDefaultApp } from '@tauri-apps/plugin-opener';
import * as fsService from '../api/fileSystemService';
import { loadExplorerPrefs, saveExplorerPrefs } from '../api/explorerPrefs';
import { getParentPath } from '../utils/pathUtils';
import type {
  FsEntry, QuickAccessLocation, SortField, SortDirection, ViewMode, ClipboardState, TrashEntry
} from '../types/fileExplorer.types';

export function useFileExplorerStore() {
  const [currentPath, setCurrentPathState] = useState<string | null>(null);
  const [homePath, setHomePath] = useState<string | null>(null);
  const [backStack, setBackStack] = useState<string[]>([]);
  const [forwardStack, setForwardStack] = useState<string[]>([]);

  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [quickAccess, setQuickAccess] = useState<QuickAccessLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [previewSize, setPreviewSize] = useState(48);
  const [search, setSearch] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null); // novo

  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const [defaultPath, setDefaultPathState] = useState<string | null>(null);

  const [columnPaths, setColumnPaths] = useState<string[]>([]);
  const [columnEntries, setColumnEntries] = useState<Record<string, FsEntry[]>>({});
  const [columnLoading, setColumnLoading] = useState<Record<string, boolean>>({});

  const [viewingTrash, setViewingTrash] = useState(false);
  const [trashItems, setTrashItems] = useState<TrashEntry[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashError, setTrashError] = useState<string | null>(null);

  const openTrash = useCallback(async () => {
    setViewingTrash(true);
    setTrashLoading(true);
    setTrashError(null);
    try {
      setTrashItems(await fsService.listTrash());
    } catch (e) {
      setTrashError(typeof e === 'string' ? e : 'Não foi possível abrir a lixeira.');
    } finally {
      setTrashLoading(false);
    }
  }, []);

  const closeTrash = useCallback(() => setViewingTrash(false), []);

  // Inicialização: pasta padrão configurada nas Configurações, senão Home do usuário.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prefs, home, quick] = await Promise.all([
          loadExplorerPrefs(),
          fsService.getHomePath(),
          fsService.getQuickAccessLocations(),
        ]);
        if (cancelled) return;
        setDefaultPathState(prefs.defaultPath);
        setViewModeState(prefs.viewMode);
        setHomePath(home);
        setQuickAccess(quick);
        setCurrentPathState(prefs.defaultPath ?? home);
      } catch {
        if (!cancelled) setError('Não foi possível iniciar o Explorador.');
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadEntries = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = await fsService.listDirectory(path);
      setEntries(list);
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Não foi possível abrir esta pasta.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function buildFlatTreeForNav(
    entries: FsEntry[],
    expandedPaths: Set<string>,
    childrenByPath: Record<string, FsEntry[]>,
  ): FsEntry[] {
    const result: FsEntry[] = [];
    for (const entry of entries) {
      result.push(entry);
      if (entry.isDir && expandedPaths.has(entry.path)) {
        result.push(...buildFlatTreeForNav(childrenByPath[entry.path] ?? [], expandedPaths, childrenByPath));
      }
    }
    return result;
  }

  useEffect(() => {
    if (currentPath) {
      loadEntries(currentPath);
      setSelectedPath(null);
      setColumnPaths([currentPath]);
      setExpandedPaths(new Set());
    }
  }, [currentPath, loadEntries]);

  useEffect(() => {
    columnPaths.forEach((path, idx) => {
      if (idx === 0) return; // raiz já é coberta por `entries`/`loadEntries`
      if (columnEntries[path] || columnLoading[path]) return;
      setColumnLoading((s) => ({ ...s, [path]: true }));
      fsService.listDirectory(path)
        .then((list) => setColumnEntries((s) => ({ ...s, [path]: sortFsEntries(list, sortField, sortDirection) })))
        .catch(() => setColumnEntries((s) => ({ ...s, [path]: [] })))
        .finally(() => setColumnLoading((s) => ({ ...s, [path]: false })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnPaths]);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    expandedPaths.forEach((path) => {
      if (columnEntries[path] || columnLoading[path]) return;
      setColumnLoading((s) => ({ ...s, [path]: true }));
      fsService.listDirectory(path)
        .then((list) => setColumnEntries((s) => ({ ...s, [path]: sortFsEntries(list, sortField, sortDirection) })))
        .catch(() => setColumnEntries((s) => ({ ...s, [path]: [] })))
        .finally(() => setColumnLoading((s) => ({ ...s, [path]: false })));
    });
  }, [expandedPaths]);

  const expandColumn = useCallback((levelIndex: number, entry: FsEntry) => {
    if (entry.isDir) {
      setColumnPaths((prev) => [...prev.slice(0, levelIndex + 1), entry.path]);
      setSelectedPath(entry.path);
    } else {
      setSelectedPath(entry.path); // arquivo: só seleciona, aparece no painel de preview
      setColumnPaths((prev) => prev.slice(0, levelIndex + 1)); // fecha colunas além deste nível
    }
  }, []);
  const closeColumnAt = useCallback((levelIndex: number) => {
    setColumnPaths((prev) => prev.slice(0, levelIndex + 1));
  }, []);

  const navigateTo = useCallback((path: string) => {
    setViewingTrash(false);
    setCurrentPathState((prev) => {
      if (prev && prev !== path) setBackStack((s) => [...s, prev]);
      return path;
    });
    setForwardStack([]);
  }, []);

  const select = useCallback((path: string | null) => {
    setSelectedPath(path);
  }, []);

  const goBack = useCallback(() => {
    setBackStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      setCurrentPathState((cur) => {
        if (cur) setForwardStack((f) => [...f, cur]);
        return prev;
      });
      return stack.slice(0, -1);
    });
  }, []);

  const goForward = useCallback(() => {
    setForwardStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1];
      setCurrentPathState((cur) => {
        if (cur) setBackStack((b) => [...b, cur]);
        return next;
      });
      return stack.slice(0, -1);
    });
  }, []);

  const canGoUp = !!currentPath && currentPath !== homePath;

  const goUp = useCallback(() => {
    if (!currentPath || !canGoUp) return;
    navigateTo(getParentPath(currentPath));
  }, [currentPath, canGoUp, navigateTo]);

  const refresh = useCallback(() => {
    if (currentPath) loadEntries(currentPath);
  }, [currentPath, loadEntries]);

  const openEntry = useCallback((entry: FsEntry) => {
    if (entry.isDir) {
      navigateTo(entry.path);
    } else {
      openWithDefaultApp(entry.path).catch(() => setError('Não foi possível abrir este arquivo.'));
    }
  }, [navigateTo]);

  const createFolder = useCallback(async (name: string) => {
    if (!currentPath) return;
    await fsService.createFolder(currentPath, name);
    refresh();
  }, [currentPath, refresh]);

  const rename = useCallback(async (entry: FsEntry, newName: string) => {
    await fsService.renamePath(entry.path, newName);
    refresh();
  }, [refresh]);

  const restoreFromTrash = useCallback(async (item: TrashEntry) => {
    await fsService.restoreTrashItem(item);
    setTrashItems((prev) => prev.filter((i) => i.id !== item.id));
    refresh(); // se restaurou pra pasta atual, atualiza a listagem
  }, [refresh]);

  const removeEntry = useCallback(async (entry: FsEntry) => {
    await fsService.deleteToTrash(entry.path);
    refresh();
  }, [refresh]);

  const copyEntry = useCallback((entry: FsEntry) => {
    setClipboard({ sourcePath: entry.path, sourceName: entry.name, mode: 'copy' });
  }, []);

  const cutEntry = useCallback((entry: FsEntry) => {
    setClipboard({ sourcePath: entry.path, sourceName: entry.name, mode: 'move' });
  }, []);


  const [viewMode, setViewModeState] = useState<ViewMode>('icons');

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);


  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    saveExplorerPrefs({ defaultPath, viewMode: mode }).catch(() => { });
  }, [defaultPath]);
  const pasteClipboard = useCallback(async () => {
    if (!clipboard || !currentPath) return;
    if (clipboard.mode === 'copy') {
      await fsService.copyPath(clipboard.sourcePath, currentPath);
    } else {
      await fsService.movePath(clipboard.sourcePath, currentPath);
      setClipboard(null); // "recortar" se consome ao colar, igual Finder/Explorer
    }
    refresh();
  }, [clipboard, currentPath, refresh]);

  const setAsDefaultPath = useCallback(async () => {
    if (!currentPath) return;
    await saveExplorerPrefs({ defaultPath: currentPath, viewMode });
    setDefaultPathState(currentPath);
  }, [currentPath, viewMode]);

  const visibleEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term ? entries.filter((e) => e.name.toLowerCase().includes(term)) : entries;
    return sortFsEntries(list, sortField, sortDirection);

  }, [entries, search, sortField, sortDirection]);

  const selectedEntry = useMemo(() => {
    const inRoot = visibleEntries.find((e) => e.path === selectedPath);
    if (inRoot) return inRoot;
    for (const list of Object.values(columnEntries)) {
      const found = list.find((e) => e.path === selectedPath);
      if (found) return found;
    }
    return null;
  }, [visibleEntries, columnEntries, selectedPath]);

  const moveSelectionVertical = useCallback((direction: 1 | -1) => {
    if (viewMode === 'list') {
      const flat = buildFlatTreeForNav(visibleEntries, expandedPaths, columnEntries);
      if (flat.length === 0) return;
      const idx = selectedPath ? flat.findIndex((e) => e.path === selectedPath) : -1;
      const nextIdx = idx === -1 ? 0 : Math.min(Math.max(idx + direction, 0), flat.length - 1);
      setSelectedPath(flat[nextIdx].path);
      return;
    }

    if (viewMode === 'columns') {
      let list: FsEntry[] = visibleEntries;
      for (let i = 0; i < columnPaths.length; i++) {
        const candidateList = i === 0 ? visibleEntries : (columnEntries[columnPaths[i]] ?? []);
        if (selectedPath && candidateList.some((e) => e.path === selectedPath)) {
          list = candidateList;
          break;
        }
      }
      if (list.length === 0) return;
      const idx = selectedPath ? list.findIndex((e) => e.path === selectedPath) : -1;
      const nextIdx = idx === -1 ? 0 : Math.min(Math.max(idx + direction, 0), list.length - 1);
      setSelectedPath(list[nextIdx].path);
    }
  }, [viewMode, visibleEntries, expandedPaths, columnEntries, columnPaths, selectedPath]);
  const totalSize = useMemo(() => visibleEntries.reduce((sum, e) => sum + e.size, 0), [visibleEntries]);

  const [quickLookOpen, setQuickLookOpen] = useState(false);

  const openQuickLook = useCallback(() => {
    if (!selectedEntry) return;
    setQuickLookOpen(true);
  }, [selectedEntry]);

  const closeQuickLook = useCallback(() => {
    setQuickLookOpen(false);
  }, []);

  const readQuickLookText = useCallback(async (path: string) => {
    return fsService.readTextFile(path);
  }, []);

  const saveQuickLookText = useCallback(async (path: string, content: string) => {
    await fsService.writeTextFile(path, content);
  }, []);

  return {
    currentPath, homePath, entries: visibleEntries, loading, initializing, error,
    canGoBack: backStack.length > 0, canGoForward: forwardStack.length > 0, canGoUp,
    navigateTo, goBack, goForward, goUp, refresh, openEntry,
    quickAccess, defaultPath, setAsDefaultPath,
    sortField, setSortField, sortDirection, setSortDirection, viewMode, setViewMode,
    search, setSearch,
    selectedPath, selectedEntry, select,
    createFolder, rename, removeEntry,
    clipboard, copyEntry, cutEntry, pasteClipboard,
    totalSize, itemCount: visibleEntries.length,
    columnPaths, columnEntries, columnLoading, expandColumn, closeColumnAt, moveSelectionVertical,
    previewSize, setPreviewSize,
    viewingTrash, openTrash, closeTrash, trashItems, trashLoading, trashError, restoreFromTrash,
    expandedPaths, toggleExpand,
    quickLookOpen, openQuickLook, closeQuickLook, readQuickLookText, saveQuickLookText,
  };
}

export type FileExplorerStore = ReturnType<typeof useFileExplorerStore>;

export function sortFsEntries(list: FsEntry[], field: SortField, direction: SortDirection): FsEntry[] {
  return [...list].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let cmp = 0;
    if (field === 'name') cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
    else if (field === 'type') cmp = (a.extension ?? '').localeCompare(b.extension ?? '');
    else if (field === 'size') cmp = a.size - b.size;
    else if (field === 'date') cmp = (a.modifiedAt ?? '').localeCompare(b.modifiedAt ?? '');
    return direction === 'asc' ? cmp : -cmp;
  });
}

