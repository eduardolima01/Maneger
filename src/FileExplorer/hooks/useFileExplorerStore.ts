import { useState, useEffect, useCallback, useMemo, useReducer, useRef } from 'react';
import { openPath as openWithDefaultApp } from '@tauri-apps/plugin-opener';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import * as fsService from '../api/fileSystemService';
import { loadExplorerPrefs, saveExplorerPrefs } from '../api/explorerPrefs';
import { startDrag } from '@crabnebula/tauri-plugin-drag';
import { getParentPath } from '../utils/pathUtils';
import { openExplorerWindow } from '../api/explorerWindowService';
import { readInitialPath } from '../utils/explorerWindowUrl';
import { PREVIEW_DEFAULT, clampPreviewSize, parseUiPrefs, serializeUiPrefs } from '../utils/explorerUiPrefs';
import {
  type FolderGroup, type PathChange, parseGroups, serializeGroups, addPathsToGroup, remapGroups, newGroupId, samePathLoose,
} from '../utils/folderGroups';
import {
  type HistoryAction, type HistoryEntry, MAX_HISTORY, isReversible, describeAction,
  undoAction, redoAction, affectedPaths, landedPaths, dirname, samePath,
} from '../utils/actionHistory';
import type {
  FsEntry, QuickAccessLocation, SortField, SortDirection, ViewMode, ClipboardState, TrashEntry
} from '../types/fileExplorer.types';

// Histórico de navegação num reducer único (pasta atual + pilhas de voltar/avançar).
// Antes eram três `useState` mexidos de dentro de updaters uns dos outros; sob
// React.StrictMode (dev) os updaters rodam duas vezes e o histórico duplicava.
interface NavState {
  current: string | null;
  back: string[];
  forward: string[];
}

type NavAction =
  | { type: 'init'; path: string }
  | { type: 'navigate'; path: string }
  | { type: 'back' }
  | { type: 'forward' };

const INITIAL_NAV: NavState = { current: null, back: [], forward: [] };

export function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case 'init':
      return { current: action.path, back: [], forward: [] };
    case 'navigate': {
      if (state.current === action.path) return { ...state, forward: [] };
      return {
        current: action.path,
        back: state.current ? [...state.back, state.current] : state.back,
        forward: [],
      };
    }
    case 'back': {
      if (state.back.length === 0) return state;
      const prev = state.back[state.back.length - 1];
      return {
        current: prev,
        back: state.back.slice(0, -1),
        forward: state.current ? [...state.forward, state.current] : state.forward,
      };
    }
    case 'forward': {
      if (state.forward.length === 0) return state;
      const next = state.forward[state.forward.length - 1];
      return {
        current: next,
        back: state.current ? [...state.back, state.current] : state.back,
        forward: state.forward.slice(0, -1),
      };
    }
  }
}

export function useFileExplorerStore() {
  const [nav, dispatchNav] = useReducer(navReducer, INITIAL_NAV);
  const { current: currentPath, back: backStack, forward: forwardStack } = nav;
  const [homePath, setHomePath] = useState<string | null>(null);

  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [quickAccess, setQuickAccess] = useState<QuickAccessLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [previewSize, setPreviewSize] = useState(PREVIEW_DEFAULT);
  const uiPrefsLoaded = useRef(false);

  // Tamanho dos ícones: lido na inicialização e salvo (com pequeno atraso, já que o Ctrl+scroll dispara
  // muitas mudanças seguidas) em explorer-ui-prefs.json.
  useEffect(() => {
    let cancelled = false;
    fsService.loadExplorerUiPrefs()
      .then((raw) => { if (!cancelled) setPreviewSize(parseUiPrefs(raw).previewSize); })
      .catch(() => { /* sem arquivo/ilegível: fica no tamanho padrão */ })
      .finally(() => { uiPrefsLoaded.current = true; });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!uiPrefsLoaded.current) return; // não grava o padrão inicial por cima do tamanho salvo
    const timer = setTimeout(() => {
      fsService.saveExplorerUiPrefs(serializeUiPrefs({ previewSize: clampPreviewSize(previewSize) })).catch(() => { });
    }, 300);
    return () => clearTimeout(timer);
  }, [previewSize]);
  const [search, setSearch] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null); // novo
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set()); // seleção múltipla; `selectedPath` continua sendo "o último clicado" (preview)

  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const [defaultPath, setDefaultPathState] = useState<string | null>(null);
  const [folderIcons, setFolderIcons] = useState<Record<string, string>>({});

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

  // Grupos de pastas da sidebar (atalhos pelo caminho absoluto), salvos em explorer-groups.json.
  const [folderGroups, setFolderGroups] = useState<FolderGroup[]>([]);
  const groupsLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fsService.loadFolderGroups()
      .then((raw) => { if (!cancelled) setFolderGroups(parseGroups(raw)); })
      .catch(() => { /* sem arquivo/ilegível: começa sem grupos */ })
      .finally(() => { groupsLoaded.current = true; });
    return () => { cancelled = true; };
  }, []);

  // Com várias janelas do Explorador, cada uma tem sua cópia dos grupos: ao focar a janela relê o arquivo,
  // então uma janela nunca grava por cima de uma alteração feita em outra sem ter visto ela antes.
  useEffect(() => {
    const reload = () => {
      if (!groupsLoaded.current) return;
      fsService.loadFolderGroups()
        .then((raw) => {
          const fresh = parseGroups(raw);
          setFolderGroups((prev) => (serializeGroups(prev) === serializeGroups(fresh) ? prev : fresh));
        })
        .catch(() => { });
    };
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, []);

  useEffect(() => {
    if (!groupsLoaded.current) return; // não grava a lista vazia inicial por cima do arquivo
    fsService.saveFolderGroups(serializeGroups(folderGroups))
      .catch(() => setError('Não foi possível salvar os grupos de pastas.'));
  }, [folderGroups]);

  const createGroup = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setFolderGroups((prev) => [...prev, { id: newGroupId(), name: trimmed, paths: [], collapsed: false }]);
  }, []);
  const renameGroup = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setFolderGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name: trimmed } : g)));
  }, []);
  const deleteGroup = useCallback((id: string) => {
    setFolderGroups((prev) => prev.filter((g) => g.id !== id)); // só remove os atalhos, nunca as pastas
  }, []);
  const toggleGroupCollapsed = useCallback((id: string) => {
    setFolderGroups((prev) => prev.map((g) => (g.id === id ? { ...g, collapsed: !g.collapsed } : g)));
  }, []);
  const addFoldersToGroup = useCallback((id: string, paths: string[]) => {
    if (paths.length === 0) return;
    setFolderGroups((prev) => prev.map((g) => (g.id === id ? addPathsToGroup(g, paths) : g)));
  }, []);
  const removeFolderFromGroup = useCallback((id: string, path: string) => {
    setFolderGroups((prev) => prev.map((g) => (g.id === id ? { ...g, paths: g.paths.filter((p) => !samePathLoose(p, path)) } : g)));
  }, []);
  /** Renomear/mover uma pasta pelo Explorador atualiza o caminho salvo nos grupos (e o de subpastas dela). */
  const remapSavedPaths = useCallback((changes: PathChange[]) => {
    if (changes.length === 0) return;
    setFolderGroups((prev) => remapGroups(prev, changes));
  }, []);

  // Histórico de ações (desfazer "r" / refazer "Alt+R"). Só vive em memória.
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const historyId = useRef(0);
  const historyBusy = useRef(false);

  const recordHistory = useCallback((action: HistoryAction) => {
    const entry: HistoryEntry = { id: ++historyId.current, label: describeAction(action), at: Date.now(), action, undone: false };
    // ação nova descarta o que estava "desfeito" (não dá mais pra refazer), igual qualquer editor
    setHistory((prev) => [...prev.filter((h) => !h.undone), entry].slice(-MAX_HISTORY));
  }, []);

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
        // janela separada abre direto na pasta de onde foi chamada (?path=...); a janela normal não tem isso
        const urlPath = readInitialPath(window.location.search);
        dispatchNav({ type: 'init', path: urlPath ?? prefs.defaultPath ?? home });
      } catch {
        if (!cancelled) setError('Não foi possível iniciar o Explorador.');
      } finally {
        if (!cancelled) setInitializing(false);
      }

      // Ícones customizados de pasta são um extra opcional, não um requisito pra abrir o
      // Explorador — uma falha aqui (ex: comando ainda não registrado no backend) não pode
      // travar a inicialização do resto (já aconteceu: ver PATCHES.md).
      try {
        const icons = await fsService.getFolderIcons();
        if (!cancelled) setFolderIcons(icons);
      } catch {
        // silencioso: sem ícones customizados carregados, mas o Explorador segue funcionando normal
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Só a última listagem pedida pode escrever no estado: navegar rápido não deixa
  // uma resposta lenta de uma pasta antiga sobrescrever a pasta atual.
  const loadRequestId = useRef(0);

  const loadEntries = useCallback(async (path: string) => {
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const list = await fsService.listDirectory(path);
      if (requestId !== loadRequestId.current) return;
      setEntries(list);
    } catch (e) {
      if (requestId !== loadRequestId.current) return;
      setError(typeof e === 'string' ? e : 'Não foi possível abrir esta pasta.');
      setEntries([]);
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
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
      setSelectedPaths(new Set());
      setColumnPaths([currentPath]);
      setExpandedPaths(new Set());
      // cache de filhos (colunas + árvore da lista) é descartado ao trocar de pasta —
      // senão voltar a uma pasta já visitada mostrava o conteúdo antigo dos filhos
      setColumnEntries({});
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
      setSelectedPaths(new Set([entry.path]));
    } else {
      setSelectedPath(entry.path); // arquivo: só seleciona, aparece no painel de preview
      setSelectedPaths(new Set([entry.path]));
      setColumnPaths((prev) => prev.slice(0, levelIndex + 1)); // fecha colunas além deste nível
    }
  }, []);
  const closeColumnAt = useCallback((levelIndex: number) => {
    setColumnPaths((prev) => prev.slice(0, levelIndex + 1));
  }, []);

  // Navegação por teclado (w/a/s/d) no modo colunas: diferente de `expandColumn`
  // (usado no clique do mouse), estas duas também MOVEM o foco de seleção pra
  // coluna lateral, permitindo continuar navegando com w/s nela.
  const [pendingColumnFocus, setPendingColumnFocus] = useState<string | null>(null);

  const expandColumnAndFocus = useCallback((levelIndex: number, entry: FsEntry) => {
    if (!entry.isDir) return;
    setColumnPaths((prev) => [...prev.slice(0, levelIndex + 1), entry.path]);
    setSelectedPath(entry.path);
    setSelectedPaths(new Set([entry.path]));
    setPendingColumnFocus(entry.path);
  }, []);

  const collapseToParentColumn = useCallback((levelIndex: number) => {
    if (levelIndex <= 0 || levelIndex >= columnPaths.length) return; // nível 0 (raiz) não tem coluna à esquerda
    const folderPath = columnPaths[levelIndex];
    setColumnPaths((prev) => prev.slice(0, levelIndex));
    setSelectedPath(folderPath);
    setSelectedPaths(new Set([folderPath]));
    setPendingColumnFocus(null); // "a" é sempre imediato, cancela qualquer foco pendente de um "d" anterior
  }, [columnPaths]);

  // Assim que a coluna alvo de `expandColumnAndFocus` terminar de carregar
  // (ou já estiver em cache), move a seleção pro primeiro item dela.
  useEffect(() => {
    if (!pendingColumnFocus) return;
    if (columnLoading[pendingColumnFocus]) return; // ainda carregando, espera o próximo disparo do efeito
    const list = columnEntries[pendingColumnFocus];
    if (!list) return; // ainda não chegou o resultado do fetch
    if (list.length > 0) {
      setSelectedPath(list[0].path);
      setSelectedPaths(new Set([list[0].path]));
    }
    // pasta vazia: mantém a seleção na própria pasta (coluna anterior), nada pra focar na nova coluna
    setPendingColumnFocus(null);
  }, [pendingColumnFocus, columnEntries, columnLoading]);

  const navigateTo = useCallback((path: string) => {
    setViewingTrash(false);
    dispatchNav({ type: 'navigate', path });
  }, []);

  const select = useCallback((path: string | null) => {
    setSelectedPath(path);
  }, []);

  const goBack = useCallback(() => {
    setViewingTrash(false);
    dispatchNav({ type: 'back' });
  }, []);

  const goForward = useCallback(() => {
    setViewingTrash(false);
    dispatchNav({ type: 'forward' });
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
    const created = await fsService.createFolder(currentPath, name);
    recordHistory({ kind: 'create-folder', path: created.path });
    refresh();
  }, [currentPath, refresh, recordHistory]);

  const rename = useCallback(async (entry: FsEntry, newName: string) => {
    const renamed = await fsService.renamePath(entry.path, newName);
    recordHistory({ kind: 'rename', from: entry.path, to: renamed.path });
    remapSavedPaths([{ from: entry.path, to: renamed.path }]);
    refresh();
  }, [refresh, recordHistory, remapSavedPaths]);

  // Recarrega pastas que estão no cache de colunas/árvore (ex: pasta de destino de um move aberta numa coluna)
  const refreshCachedDirs = useCallback((paths: string[]) => {
    const dirs = new Set<string>();
    for (const p of paths) { dirs.add(p); dirs.add(dirname(p)); }
    dirs.forEach((dir) => {
      if (!(dir in columnEntries)) return;
      fsService.listDirectory(dir)
        .then((list) => setColumnEntries((prev) => ({ ...prev, [dir]: sortFsEntries(list, sortField, sortDirection) })))
        .catch(() => { /* pasta sumiu: o cache antigo some no próximo refresh */ });
    });
  }, [columnEntries, sortField, sortDirection]);

  const restoreFromTrash = useCallback(async (item: TrashEntry) => {
    await fsService.restoreTrashItem(item);
    setTrashItems((prev) => prev.filter((i) => i.id !== item.id));
    refresh(); // se restaurou pra pasta atual, atualiza a listagem
  }, [refresh]);

  const removeEntry = useCallback(async (entry: FsEntry) => {
    await fsService.deleteToTrash(entry.path);
    refresh();
  }, [refresh]);

  // Evita dois lotes ao mesmo tempo (exclusão ou mover; ex: apertar `q` duas vezes antes do primeiro terminar)
  const deleteInFlight = useRef(false);

  /**
   * Exclui vários itens de uma vez: `trash` manda pra lixeira do SO, `permanent` apaga de vez.
   * Mantém selecionado tudo que NÃO foi excluído (e o que falhar continua selecionado), limpa
   * dos caches de colunas/árvore só o que realmente saiu do disco, e atualiza a listagem uma vez.
   */
  const removeEntries = useCallback(async (list: FsEntry[], mode: 'trash' | 'permanent') => {
    if (list.length === 0 || deleteInFlight.current) return;
    deleteInFlight.current = true;
    const removed: string[] = [];
    const removedMeta: { path: string; name: string }[] = [];
    let failure: string | null = null;
    try {
      for (const entry of list) {
        try {
          if (mode === 'trash') await fsService.deleteToTrash(entry.path);
          else await fsService.deletePermanently(entry.path);
          removed.push(entry.path);
          removedMeta.push({ path: entry.path, name: entry.name });
        } catch (e) {
          failure = typeof e === 'string' ? e : `Não foi possível excluir "${entry.name}".`;
        }
      }
    } finally {
      deleteInFlight.current = false;
    }

    if (removedMeta.length > 0) {
      recordHistory(mode === 'trash' ? { kind: 'trash', items: removedMeta } : { kind: 'permanent-delete', items: removedMeta });
    }

    if (removed.length > 0) {
      const gone = new Set(removed);
      const remaining = Array.from(selectedPaths).filter((p) => !gone.has(p));
      setSelectedPaths(new Set(remaining));
      setSelectedPath(
        selectedPath && !gone.has(selectedPath) ? selectedPath : (remaining[remaining.length - 1] ?? null),
      );
      setColumnEntries((prev) => {
        const next: Record<string, FsEntry[]> = {};
        for (const [key, value] of Object.entries(prev)) {
          if (gone.has(key)) continue; // pasta excluída: cache dela some junto
          next[key] = value.filter((e) => !gone.has(e.path));
        }
        return next;
      });
      // coluna aberta cuja pasta foi excluída (e as à direita dela) fecha
      setColumnPaths((prev) => {
        const cut = prev.findIndex((p, i) => i > 0 && gone.has(p));
        return cut === -1 ? prev : prev.slice(0, cut);
      });
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        gone.forEach((p) => next.delete(p));
        return next;
      });
    }
    refresh(); // `refresh` zera `error` ao começar, então o erro desta rodada vem depois
    if (failure) setError(failure);
  }, [selectedPaths, selectedPath, refresh, recordHistory]);

  /**
   * Arrastar PRA FORA do app (outros programas, Explorer, navegador...): inicia um arraste nativo do SO
   * com esses arquivos. Depois recarrega a listagem, porque quem recebeu pode ter movido os arquivos.
   */
  const startSystemDrag = useCallback(async (list: FsEntry[]) => {
    if (list.length === 0) return;
    let failure: string | null = null;
    try {
      const icon = await fsService.getDragIconPath();
      await startDrag({ item: list.map((e) => e.path), icon });
    } catch (e) {
      failure = typeof e === 'string' ? e : 'Não foi possível arrastar os arquivos pra fora do app.';
    }
    refresh(); // `refresh` zera `error` ao começar, então o erro desta rodada vem depois
    if (failure) setError(failure);
  }, [refresh]);

  /** Abre o Explorador numa janela separada (sem aside/abas), já na pasta atual. */
  const openInNewWindow = useCallback(() => {
    openExplorerWindow(currentPath).catch(() => setError('Não foi possível abrir a nova janela.'));
  }, [currentPath]);

  const openCurrentFolderInSystem = useCallback(() => {
    if (!currentPath) return;
    openWithDefaultApp(currentPath).catch(() => setError('Não foi possível abrir a pasta no explorador do sistema.'));
  }, [currentPath]);

  // Ícone customizado de pasta — fonte pode ser um arquivo escolhido no sistema ou colado
  // do clipboard; salvo em configuração própria do app (nunca dentro da pasta do usuário).
  const setFolderIconFromFile = useCallback(async (folderPath: string) => {
    try {
      const selected = await openFileDialog({
        multiple: false,
        filters: [{ name: 'Imagem', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
      });
      if (!selected || typeof selected !== 'string') return; // usuário cancelou o diálogo
      const iconPath = await fsService.setFolderIconFromPath(folderPath, selected);
      setFolderIcons((prev) => ({ ...prev, [folderPath]: iconPath }));
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Não foi possível definir o ícone da pasta.');
    }
  }, []);

  const setFolderIconFromClipboard = useCallback(async (folderPath: string) => {
    try {
      const iconPath = await fsService.setFolderIconFromClipboard(folderPath);
      setFolderIcons((prev) => ({ ...prev, [folderPath]: iconPath }));
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Não foi possível colar a imagem como ícone da pasta.');
    }
  }, []);

  const removeFolderIcon = useCallback(async (folderPath: string) => {
    try {
      await fsService.removeFolderIcon(folderPath);
      setFolderIcons((prev) => {
        const next = { ...prev };
        delete next[folderPath];
        return next;
      });
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Não foi possível remover o ícone customizado.');
    }
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
    // Em lote, um conflito (ex: "já existe no destino") NÃO aborta os itens seguintes:
    // cola o que der e avisa quantos falharam.
    const moved: string[] = [];
    const copiedItems: { source: string; copy: string }[] = [];
    const movedItems: { from: string; to: string }[] = [];
    let failures = 0;
    let firstFailure: string | null = null;
    for (const item of clipboard.entries) {
      try {
        if (clipboard.mode === 'copy') {
          const res = await fsService.copyPath(item.sourcePath, currentPath);
          copiedItems.push({ source: item.sourcePath, copy: res.path });
        } else {
          const res = await fsService.movePath(item.sourcePath, currentPath);
          moved.push(item.sourcePath);
          movedItems.push({ from: item.sourcePath, to: res.path });
        }
      } catch (e) {
        failures += 1;
        if (!firstFailure) firstFailure = typeof e === 'string' ? e : `Não foi possível colar "${item.sourceName}".`;
      }
    }
    if (copiedItems.length > 0) recordHistory({ kind: 'copy', items: copiedItems });
    if (movedItems.length > 0) {
      recordHistory({ kind: 'move', items: movedItems });
      remapSavedPaths(movedItems);
    }
    if (clipboard.mode === 'move') {
      setClipboard(null); // "recortar" se consome ao colar, igual Finder/Explorer
      if (moved.length > 0) {
        // o que foi movido saiu do lugar de origem: não pode continuar na seleção
        const gone = new Set(moved);
        const remaining = Array.from(selectedPaths).filter((p) => !gone.has(p));
        setSelectedPaths(new Set(remaining));
        setSelectedPath(selectedPath && !gone.has(selectedPath) ? selectedPath : (remaining[remaining.length - 1] ?? null));
      }
    }
    refresh(); // `refresh` zera `error` ao começar, então o erro desta rodada vem depois
    if (failures > 0) {
      setError(failures > 1 ? `${failures} itens não foram colados. Primeiro erro: ${firstFailure}` : (firstFailure as string));
    }
  }, [clipboard, currentPath, refresh, selectedPaths, selectedPath, recordHistory, remapSavedPaths]);

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

  const clearSelection = useCallback(() => {
    setSelectedPath(null);
    setSelectedPaths(new Set());
  }, []);

  /** Define a seleção inteira de uma vez (caixa de seleção, Ctrl+A). O último da lista vira o "item atual" (preview). */
  const selectPaths = useCallback((paths: string[]) => {
    const unique = Array.from(new Set(paths));
    setSelectedPaths(new Set(unique));
    setSelectedPath(unique.length > 0 ? unique[unique.length - 1] : null);
  }, []);

  interface SelectModifiers { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; }

  /** Ordem visível padrão pra ícones/lista (colunas sempre informam a própria ordem explicitamente, já que cada coluna é uma lista separada). */
  const getDefaultOrderedPaths = useCallback((): string[] => (
    viewMode === 'list'
      ? buildFlatTreeForNav(visibleEntries, expandedPaths, columnEntries).map((e) => e.path)
      : visibleEntries.map((e) => e.path)
  ), [viewMode, visibleEntries, expandedPaths, columnEntries]);

  /**
   * Clique com suporte a Ctrl/Cmd (marca/desmarca um item) e Shift (seleciona o intervalo
   * desde o último item clicado). `orderedPaths` é a ordem visível da lista onde o clique
   * aconteceu — obrigatório em colunas (cada coluna tem sua própria ordem); em ícones/lista
   * dá pra omitir, que o Store deduz a partir da própria visão atual.
   *
   * Simplificação assumida (não é o Finder 100% fiel): o intervalo do Shift sempre parte do
   * último item clicado (de qualquer tipo de clique), não de uma "âncora" fixa separada —
   * mantém `selectedPath` sempre como "o último clicado" pro painel de preview.
   */
  const selectWithModifiers = useCallback((path: string, modifiers: SelectModifiers, orderedPaths?: string[]) => {
    const isRange = modifiers.shiftKey;
    const isToggle = !isRange && (modifiers.ctrlKey || modifiers.metaKey);

    if (isRange && selectedPath) {
      const order = orderedPaths ?? getDefaultOrderedPaths();
      const fromIdx = order.indexOf(selectedPath);
      const toIdx = order.indexOf(path);
      if (fromIdx !== -1 && toIdx !== -1) {
        const [start, end] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
        setSelectedPaths(new Set(order.slice(start, end + 1)));
        setSelectedPath(path);
        return;
      }
      // item de fora da lista informada (ex: veio de outra coluna): cai pro clique simples abaixo
    }

    if (isToggle) {
      const base = selectedPaths.size > 0 ? selectedPaths : new Set(selectedPath ? [selectedPath] : []);
      const next = new Set(base);
      if (next.has(path)) {
        next.delete(path);
        setSelectedPaths(next);
        // se desmarcou justo o item que era "o último clicado", o preview precisa de um novo dono
        if (path === selectedPath) {
          const remaining = Array.from(next);
          setSelectedPath(remaining.length > 0 ? remaining[remaining.length - 1] : null);
        }
      } else {
        next.add(path);
        setSelectedPaths(next);
        setSelectedPath(path);
      }
      return;
    }

    // clique simples: reseta a seleção pra só esse item
    setSelectedPaths(new Set([path]));
    setSelectedPath(path);
  }, [selectedPath, selectedPaths, getDefaultOrderedPaths]);

  // Seleção por arrastar o mouse ("pintar" a seleção): mousedown num item sem
  // modificadores arma o início; enquanto o botão estiver pressionado, passar por
  // cima de outros itens da MESMA lista/coluna estende um intervalo contínuo — mesmo
  // cálculo do Shift+clique, só que recalculado a cada item sobrevoado. Só cobre
  // arrastar "de um arquivo pro outro"; não desenha uma caixa de marcação a partir de
  // espaço vazio (isso exigiria medir a posição de cada item na tela).
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragAnchorPath, setDragAnchorPath] = useState<string | null>(null);
  const [dragOrderedPaths, setDragOrderedPaths] = useState<string[] | null>(null);

  const startDragSelection = useCallback((path: string, orderedPaths?: string[]) => {
    setSelectedPath(path);
    setSelectedPaths(new Set([path]));
    setDragAnchorPath(path);
    setDragOrderedPaths(orderedPaths ?? getDefaultOrderedPaths());
    setIsDragSelecting(true);
  }, [getDefaultOrderedPaths]);

  const extendDragSelection = useCallback((path: string) => {
    if (!isDragSelecting || !dragAnchorPath || !dragOrderedPaths) return;
    const fromIdx = dragOrderedPaths.indexOf(dragAnchorPath);
    const toIdx = dragOrderedPaths.indexOf(path);
    if (fromIdx === -1 || toIdx === -1) return; // item de outra lista/coluna: ignora, não estende
    const [start, end] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
    setSelectedPaths(new Set(dragOrderedPaths.slice(start, end + 1)));
    setSelectedPath(path);
  }, [isDragSelecting, dragAnchorPath, dragOrderedPaths]);

  const endDragSelection = useCallback(() => {
    setIsDragSelecting(false);
    setDragAnchorPath(null);
    setDragOrderedPaths(null);
  }, []);

  /**
   * Resolve quais entries uma ação (copiar/recortar/excluir) deve afetar: se `entry` já faz
   * parte da seleção múltipla atual, afeta todos os selecionados; senão, afeta só `entry`
   * (comportamento padrão de Finder/Explorer pra clique direito fora da seleção).
   */
  /** Ctrl+A em ícones/lista: tudo que está visível (na lista em árvore, inclui os filhos das pastas expandidas). */
  const selectAll = useCallback(() => selectPaths(getDefaultOrderedPaths()), [selectPaths, getDefaultOrderedPaths]);

  /**
   * Move os itens pra `destDir` (usado ao arrastar). Se o destino é a pasta aberta, os itens movidos
   * ficam selecionados lá; senão saem da seleção. Um conflito não aborta os demais.
   */
  const moveEntries = useCallback(async (list: FsEntry[], destDir: string) => {
    if (list.length === 0 || deleteInFlight.current) return;
    deleteInFlight.current = true;
    const moved: { from: string; to: string }[] = [];
    let failures = 0;
    let firstFailure: string | null = null;
    try {
      for (const entry of list) {
        if (samePath(dirname(entry.path), destDir)) continue; // já está nessa pasta
        try {
          const res = await fsService.movePath(entry.path, destDir);
          moved.push({ from: entry.path, to: res.path });
        } catch (e) {
          failures += 1;
          if (!firstFailure) firstFailure = typeof e === 'string' ? e : `Não foi possível mover "${entry.name}".`;
        }
      }
    } finally {
      deleteInFlight.current = false;
    }

    if (moved.length > 0) {
      recordHistory({ kind: 'move', items: moved });
      remapSavedPaths(moved);
      const gone = new Set(moved.map((m) => m.from));
      if (currentPath && samePath(destDir, currentPath)) {
        selectPaths(moved.map((m) => m.to));
      } else {
        const remaining = Array.from(selectedPaths).filter((p) => !gone.has(p));
        setSelectedPaths(new Set(remaining));
        setSelectedPath(selectedPath && !gone.has(selectedPath) ? selectedPath : (remaining[remaining.length - 1] ?? null));
      }
      setColumnEntries((prev) => {
        const next: Record<string, FsEntry[]> = {};
        for (const [key, value] of Object.entries(prev)) {
          if (gone.has(key)) continue;
          next[key] = value.filter((e) => !gone.has(e.path));
        }
        return next;
      });
      setColumnPaths((prev) => {
        const cut = prev.findIndex((p, i) => i > 0 && gone.has(p));
        return cut === -1 ? prev : prev.slice(0, cut);
      });
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        gone.forEach((p) => next.delete(p));
        return next;
      });
      refreshCachedDirs([destDir, ...moved.map((m) => m.from)]);
    }
    refresh();
    if (failures > 0) {
      setError(failures > 1 ? `${failures} itens não foram movidos. Primeiro erro: ${firstFailure}` : (firstFailure as string));
    }
  }, [currentPath, selectedPaths, selectedPath, selectPaths, refresh, refreshCachedDirs, recordHistory, remapSavedPaths]);

  // Desfazer ("r") = inverte a ação mais recente que ainda está "feita" e é reversível;
  // refazer ("Alt+R") = reaplica a mais antiga entre as desfeitas.
  const runHistory = useCallback(async (direction: 'undo' | 'redo') => {
    if (historyBusy.current || deleteInFlight.current) return;
    const target = direction === 'undo'
      ? [...history].reverse().find((h) => !h.undone && isReversible(h.action))
      : history.find((h) => h.undone);
    if (!target) return;
    historyBusy.current = true;
    let failureMessage: string | null = null;
    try {
      const result = direction === 'undo'
        ? await undoAction(target.action, fsService)
        : await redoAction(target.action, fsService);
      const nextAction = result.action ?? target.action;
      if (result.complete) {
        // desfazer/refazer também move/renomeia pastas: mantém os atalhos dos grupos apontando pro lugar certo
        const a = target.action;
        if (a.kind === 'move') {
          remapSavedPaths(a.items.map((it) => (direction === 'undo' ? { from: it.to, to: it.from } : { from: it.from, to: it.to })));
        } else if (a.kind === 'rename') {
          remapSavedPaths([direction === 'undo' ? { from: a.to, to: a.from } : { from: a.from, to: a.to }]);
        }
      }
      setHistory((prev) => prev.map((h) => (h.id !== target.id ? h : {
        ...h,
        action: nextAction,
        label: describeAction(nextAction),
        undone: result.complete ? direction === 'undo' : h.undone,
      })));
      if (!result.complete) {
        failureMessage = `${direction === 'undo' ? 'Desfazer' : 'Refazer'} incompleto — ${result.errors[0]}`;
      }
      refreshCachedDirs([...affectedPaths(target.action), ...affectedPaths(nextAction)]);
      const landed = landedPaths(target.action, direction)
        .filter((p) => currentPath && samePath(dirname(p), currentPath));
      if (landed.length > 0) selectPaths(landed);
      else clearSelection();
    } catch (e) {
      failureMessage = `Não foi possível ${direction === 'undo' ? 'desfazer' : 'refazer'}: ${typeof e === 'string' ? e : (e instanceof Error ? e.message : 'erro desconhecido')}`;
    } finally {
      historyBusy.current = false;
    }
    refresh(); // `refresh` zera `error` ao começar, então o erro desta rodada vem depois
    if (viewingTrash) openTrash(); // a lista da lixeira (se aberta) mudou
    if (failureMessage) setError(failureMessage);
  }, [history, currentPath, selectPaths, clearSelection, refresh, refreshCachedDirs, viewingTrash, openTrash, remapSavedPaths]);

  const undo = useCallback(() => runHistory('undo'), [runHistory]);
  const redo = useCallback(() => runHistory('redo'), [runHistory]);
  const canUndo = useMemo(() => history.some((h) => !h.undone && isReversible(h.action)), [history]);
  const canRedo = useMemo(() => history.some((h) => h.undone), [history]);

  const entriesForAction = useCallback((entry: FsEntry): FsEntry[] => {
    if (selectedPaths.has(entry.path) && selectedPaths.size > 1) {
      const found: FsEntry[] = [];
      for (const pool of [visibleEntries, ...Object.values(columnEntries)]) {
        for (const e of pool) {
          if (selectedPaths.has(e.path) && !found.some((f) => f.path === e.path)) found.push(e);
        }
      }
      return found;
    }
    return [entry];
  }, [selectedPaths, visibleEntries, columnEntries]);

  const copyEntry = useCallback((entry: FsEntry) => {
    const list = entriesForAction(entry);
    setClipboard({ entries: list.map((e) => ({ sourcePath: e.path, sourceName: e.name })), mode: 'copy' });
  }, [entriesForAction]);

  const cutEntry = useCallback((entry: FsEntry) => {
    const list = entriesForAction(entry);
    setClipboard({ entries: list.map((e) => ({ sourcePath: e.path, sourceName: e.name })), mode: 'move' });
  }, [entriesForAction]);

  const moveSelectionVertical = useCallback((direction: 1 | -1) => {
    if (viewMode === 'list') {
      const flat = buildFlatTreeForNav(visibleEntries, expandedPaths, columnEntries);
      if (flat.length === 0) return;
      const idx = selectedPath ? flat.findIndex((e) => e.path === selectedPath) : -1;
      const nextIdx = idx === -1 ? 0 : Math.min(Math.max(idx + direction, 0), flat.length - 1);
      setSelectedPath(flat[nextIdx].path);
      setSelectedPaths(new Set([flat[nextIdx].path]));
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
      setSelectedPaths(new Set([list[nextIdx].path]));
    }
  }, [viewMode, visibleEntries, expandedPaths, columnEntries, columnPaths, selectedPath]);
  const totalSize = useMemo(() => visibleEntries.reduce((sum, e) => sum + e.size, 0), [visibleEntries]);

  // Conteúdo da pasta selecionada, pro painel de visualização da direita (só no modo ícones, com UMA
  // pasta selecionada). Recarrega quando a listagem atual muda (refresh depois de colar/excluir etc.).
  const [folderPreview, setFolderPreview] = useState<
    { path: string; entries: FsEntry[]; loading: boolean; error: string | null } | null
  >(null);
  const previewFolderPath =
    viewMode === 'icons' && selectedPaths.size === 1 && selectedEntry?.isDir ? selectedEntry.path : null;

  useEffect(() => {
    if (!previewFolderPath) {
      setFolderPreview(null);
      return;
    }
    let cancelled = false; // clicar em outra coisa antes de terminar descarta esta resposta
    setFolderPreview((prev) => ({
      path: previewFolderPath,
      entries: prev && prev.path === previewFolderPath ? prev.entries : [], // sem piscar ao recarregar a mesma pasta
      loading: true,
      error: null,
    }));
    fsService.listDirectory(previewFolderPath)
      .then((list) => {
        if (!cancelled) setFolderPreview({ path: previewFolderPath, entries: sortFsEntries(list, sortField, sortDirection), loading: false, error: null });
      })
      .catch((e) => {
        if (!cancelled) setFolderPreview({ path: previewFolderPath, entries: [], loading: false, error: typeof e === 'string' ? e : 'Não foi possível abrir esta pasta.' });
      });
    return () => { cancelled = true; };
  }, [previewFolderPath, visibleEntries, sortField, sortDirection]);

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
    selectedPaths, selectWithModifiers, selectPaths, selectAll, clearSelection, entriesForAction,
    folderGroups, createGroup, renameGroup, deleteGroup, toggleGroupCollapsed, addFoldersToGroup, removeFolderFromGroup,
    openInNewWindow, moveEntries, startSystemDrag, history, undo, redo, canUndo, canRedo,
    startDragSelection, extendDragSelection, endDragSelection,
    createFolder, rename, removeEntry, removeEntries, openCurrentFolderInSystem,
    clipboard, copyEntry, cutEntry, pasteClipboard,
    folderIcons, setFolderIconFromFile, setFolderIconFromClipboard, removeFolderIcon,
    totalSize, itemCount: visibleEntries.length, folderPreview,
    columnPaths, columnEntries, columnLoading, expandColumn, closeColumnAt, moveSelectionVertical,
    expandColumnAndFocus, collapseToParentColumn,
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
