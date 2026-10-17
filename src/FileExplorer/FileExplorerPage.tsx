import { CSSProperties, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useTabMeta } from '@/components/layout/tabs/useTabMeta';
import { useFileExplorerStore } from './hooks/useFileExplorerStore';
import ExplorerToolbar from './components/ExplorerToolbar';
import ExplorerBreadcrumb from './components/ExplorerBreadcrumb';
import ExplorerSidebar from './components/ExplorerSidebar';
import ExplorerFileGrid from './components/ExplorerFileGrid';
import ExplorerFileList from './components/ExplorerFileList';
import ExplorerStatusBar from './components/ExplorerStatusBar';
import NamePromptModal from './components/NamePromptModal';
import type { FsEntry } from './types/fileExplorer.types';
import type { FolderGroup } from './utils/folderGroups';
import { PREVIEW_STEP, clampPreviewSize, wheelToSize } from './utils/explorerUiPrefs';
import ExplorerThumbnail from './components/ExplorerThumbnail';
import { formatBytes, formatModifiedDate } from './utils/formatters';
import { getMediaKind, isTextFile } from '@/FileExplorer/utils/mediaType';

import { MdChevronRight, MdOpenInNew, MdLaunch, MdDelete, MdDeleteForever, MdHistory, MdUndo, MdRedo } from 'react-icons/md';
import { dirname, samePath, isReversible } from './utils/actionHistory';
import { getFileIcon } from './utils/fileIcon';
import { convertFileSrc } from '@tauri-apps/api/core';
import Modal from '@/components/ui/Modal';

// ---- Tema claro/escuro ----
// Tudo que tem cor usa classes Tailwind com a variante `dark:`. Pra funcionar, o app precisa pôr a
// classe `dark` num ancestral (ex: <html class="dark">) e o Tailwind precisa estar com o dark mode
// por classe (v3: `darkMode: 'class'`; v4: `@custom-variant dark (&:where(.dark, .dark *));`).
// Atalhos de criação, todos na mão esquerda (junto de q=lixeira, r=desfazer, w/a/s/d=navegar). Mude aqui se preferir outras.
const NEW_FOLDER_KEY = 'f'; // F de Folder/pasta
const NEW_FILE_KEY = 'e'; // E de arquivo
const MUTED = 'text-zinc-500 dark:text-zinc-400';
/** Quantos itens da pasta selecionada o painel da direita lista (o resto vira "+ N itens"). */
const PREVIEW_LIST_LIMIT = 100;
const SELECTED_BG = 'bg-blue-100 dark:bg-blue-500/25';
const BORDER = 'border-zinc-200 dark:border-zinc-700';
const BTN =
  'flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 ' +
  'hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700';

const QUICKLOOK_WIDTH = 720;
const QUICKLOOK_HEIGHT = 560;

function QuickLookContent({
  entry,
  readQuickLookText,
  saveQuickLookText,
}: {
  entry: FsEntry;
  readQuickLookText: (path: string) => Promise<string>;
  saveQuickLookText: (path: string, content: string) => Promise<void>;
}) {
  const mediaKind = getMediaKind(entry);
  const isText = isTextFile(entry);
  const assetUrl = convertFileSrc(entry.path);

  const [text, setText] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isText) return;
    let cancelled = false;
    setText(null);
    setTextError(null);
    readQuickLookText(entry.path)
      .then((content) => {
        if (!cancelled) setText(content);
      })
      .catch((err) => {
        if (!cancelled) setTextError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [entry.path, isText, readQuickLookText]);

  const handleSave = async () => {
    if (text === null) return;
    setSaving(true);
    try {
      await saveQuickLookText(entry.path, text);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setTextError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const baseContainerStyle: CSSProperties = {
    width: QUICKLOOK_WIDTH,
    height: QUICKLOOK_HEIGHT,
    maxWidth: '90vw',
    maxHeight: '85vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  if (mediaKind === 'image') {
    return (
      <div style={baseContainerStyle}>
        <img
          src={assetUrl}
          alt={entry.name}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </div>
    );
  }

  if (mediaKind === 'video') {
    return (
      <div style={baseContainerStyle}>
        <video src={assetUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%' }} />
      </div>
    );
  }

  if (mediaKind === 'audio') {
    return (
      <div style={baseContainerStyle}>
        <audio src={assetUrl} controls autoPlay style={{ width: '90%' }} />
      </div>
    );
  }

  if (isText) {
    if (textError) {
      return (
        <div style={baseContainerStyle}>
          <div className="text-sm text-red-600 dark:text-red-400">{textError}</div>
        </div>
      );
    }
    if (text === null) {
      return (
        <div style={baseContainerStyle}>
          <div className={`text-sm ${MUTED}`}>Carregando...</div>
        </div>
      );
    }
    return (
      <div
        style={{
          ...baseContainerStyle,
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="box-border w-full flex-1 resize-none overflow-auto rounded-md border border-zinc-300 bg-white p-2 font-mono text-[13px] text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-2 self-end rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    );
  }

  return (
    <div style={baseContainerStyle}>
      <div className={`text-sm ${MUTED}`}>
        Prévia não suportada para este tipo de arquivo.
      </div>
    </div>
  );
}

/** Ícone de um item da pasta no painel da direita: imagem de verdade só pra imagens e pastas com ícone
 *  customizado (lazy); o resto vira emoji grande — sem criar <video>/<audio> pra cada arquivo da pasta. */
function PreviewTile({ entry, size, customIconPath }: { entry: FsEntry; size: number; customIconPath?: string }) {
  const isImage = getMediaKind(entry) === 'image';
  if ((entry.isDir && customIconPath) || isImage) {
    return (
      <img
        src={convertFileSrc(entry.isDir ? (customIconPath as string) : entry.path)}
        alt={entry.name}
        loading="lazy"
        className="rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center leading-none"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.6) }}
    >
      {getFileIcon(entry)}
    </span>
  );
}

export default function FileExplorerPage() {
  const store = useFileExplorerStore();
  const {
    currentPath, entries, loading, initializing, error,
    navigateTo, refresh, openEntry, quickAccess,
    sortField, sortDirection, setSortField, setSortDirection, viewMode,
    createFolder, createFile, rename, removeEntries, openCurrentFolderInSystem,
    folderGroups, createGroup, renameGroup, deleteGroup, toggleGroupCollapsed, addFoldersToGroup, removeFolderFromGroup,
    openInNewWindow, moveEntries, startSystemDrag, history, undo, redo, canUndo, canRedo, folderPreview,
    clipboard, copyEntry, cutEntry, pasteClipboard,
    folderIcons, setFolderIconFromFile, setFolderIconFromClipboard, removeFolderIcon,
    selectedEntry,
    selectedPaths, selectWithModifiers, selectPaths, selectAll, clearSelection, entriesForAction,
    startDragSelection, extendDragSelection, endDragSelection,
    itemCount, totalSize,
    columnPaths, columnEntries, columnLoading, expandColumn, goUp, moveSelectionVertical,
    expandColumnAndFocus, collapseToParentColumn,
    previewSize, setPreviewSize,
    viewingTrash, openTrash, closeTrash, restoreFromTrash, trashItems, trashLoading, trashError,
    expandedPaths, toggleExpand,
    quickLookOpen, closeQuickLook, readQuickLookText, saveQuickLookText, openQuickLook
  } = store;

  useTabMeta({
    title: 'Explorador',
    icon: '🗂️',
    status: initializing ? 'loading' : 'ready',
  });

  const [entryMenu, setEntryMenu] = useState<{ x: number; y: number; entry: FsEntry } | null>(null);
  const [emptyAreaMenu, setEmptyAreaMenu] = useState<{ x: number; y: number } | null>(null);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFileOpen, setCreateFileOpen] = useState(false);
  // criar (group: null) / renomear grupo da sidebar, e grupo aguardando confirmação de exclusão
  const [groupModal, setGroupModal] = useState<{ group: FolderGroup | null } | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<FolderGroup | null>(null);
  const [renamingEntry, setRenamingEntry] = useState<FsEntry | null>(null);
  // Excluir = lixeira direto, sem confirmação. Só a exclusão PERMANENTE (Alt+Q) pede confirmação.
  const [permanentDeleting, setPermanentDeleting] = useState<FsEntry[] | null>(null);

  const handleSort = (field: typeof sortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const entryContextItems = (entry: FsEntry): ContextMenuItem[] => {
    const count = selectedPaths.has(entry.path) ? selectedPaths.size : 1;
    const suffix = count > 1 ? ` (${count} itens)` : '';
    return [
      { label: entry.isDir ? 'Abrir' : 'Abrir com app padrão', onClick: () => openEntry(entry), disabled: count > 1 },
      { label: 'Renomear', onClick: () => setRenamingEntry(entry), disabled: count > 1 },
      { label: `Copiar${suffix}`, onClick: () => copyEntry(entry) },
      { label: `Recortar${suffix}`, onClick: () => cutEntry(entry) },
      ...(folderGroups.length > 0 && entriesForAction(entry).some((it) => it.isDir)
        ? folderGroups.map((group) => ({
          label: `Adicionar ao grupo "${group.name}"`,
          onClick: () => addFoldersToGroup(group.id, entriesForAction(entry).filter((it) => it.isDir).map((it) => it.path)),
        }))
        : []),
      ...(entry.isDir && count === 1
        ? [
          { label: 'Ícone: escolher imagem...', onClick: () => setFolderIconFromFile(entry.path) },
          { label: 'Ícone: colar da área de transferência', onClick: () => setFolderIconFromClipboard(entry.path) },
          ...(folderIcons[entry.path]
            ? [{ label: 'Remover ícone customizado', onClick: () => removeFolderIcon(entry.path) }]
            : []),
        ]
        : []),
      { label: `Enviar para a lixeira${suffix}`, danger: true, onClick: () => removeEntries(entriesForAction(entry), 'trash') },
      { label: `Excluir permanentemente${suffix}`, danger: true, onClick: () => setPermanentDeleting(entriesForAction(entry)) },
    ];
  };

  // Clique direito em espaço vazio com itens selecionados (ex: logo depois da caixa de seleção):
  // oferece as ações em lote sem precisar acertar um dos itens.
  const selectionItems: ContextMenuItem[] =
    selectedPaths.size > 0 && selectedEntry
      ? [
        { label: `Copiar (${selectedPaths.size} ${selectedPaths.size > 1 ? 'itens' : 'item'})`, onClick: () => copyEntry(selectedEntry) },
        { label: `Recortar (${selectedPaths.size} ${selectedPaths.size > 1 ? 'itens' : 'item'})`, onClick: () => cutEntry(selectedEntry) },
        { label: `Enviar para a lixeira (${selectedPaths.size} ${selectedPaths.size > 1 ? 'itens' : 'item'})`, danger: true, onClick: () => removeEntries(entriesForAction(selectedEntry), 'trash') },
        { label: `Excluir permanentemente (${selectedPaths.size} ${selectedPaths.size > 1 ? 'itens' : 'item'})`, danger: true, onClick: () => setPermanentDeleting(entriesForAction(selectedEntry)) },
      ]
      : [];

  const emptyAreaItems: ContextMenuItem[] = [
    ...selectionItems,
    { label: `Nova pasta (${NEW_FOLDER_KEY.toUpperCase()})`, onClick: () => setCreateFolderOpen(true) },
    { label: `Novo arquivo (${NEW_FILE_KEY.toUpperCase()})`, onClick: () => setCreateFileOpen(true) },
    { label: 'Colar', onClick: () => pasteClipboard(), disabled: !clipboard },
    { label: 'Atualizar (Shift+R)', onClick: () => refresh() },
    { label: 'Abrir no explorador do sistema', onClick: () => openCurrentFolderInSystem() },
  ];

  // ---- Caixa de seleção (marquee) ----
  // Mousedown em ESPAÇO VAZIO da área de arquivos + arrastar desenha um retângulo; todo item
  // (elemento com `data-entry-path`) que tocar o retângulo entra na seleção. Ctrl/Cmd/Shift no
  // mousedown soma à seleção atual. A geometria usa coordenadas da janela (getBoundingClientRect),
  // então funciona igual em ícones, lista e colunas, mesmo com rolagem interna.
  const contentRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  // O mousedown que originou o clique caiu em cima de um item? (arrastar de um item pra outro termina
  // num `click` no ancestral comum — um clique "em espaço vazio" falso que limparia a seleção)
  const downOnItemRef = useRef(false);
  const marqueeCleanupRef = useRef<(() => void) | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => () => marqueeCleanupRef.current?.(), []);

  // ---- Ctrl + scroll na área de arquivos muda o tamanho dos ícones ----
  // Precisa ser um listener nativo NÃO passivo: o `onWheel` do React é passivo e não deixa cancelar, e
  // sem `preventDefault` o WebView aplica zoom na página inteira. Pinça do touchpad também chega como
  // wheel com ctrlKey. O valor "quebrado" fica numa ref pra os deltas pequenos do touchpad se acumularem.
  const sizeFloatRef = useRef(previewSize);
  useEffect(() => {
    if (Math.abs(sizeFloatRef.current - previewSize) >= PREVIEW_STEP) sizeFloatRef.current = previewSize; // mudou pelo slider
  }, [previewSize]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const container = contentRef.current;
      if (!container || !(e.target instanceof Node) || !container.contains(e.target)) return;
      e.preventDefault();
      sizeFloatRef.current = wheelToSize(sizeFloatRef.current, e.deltaY);
      setPreviewSize(clampPreviewSize(sizeFloatRef.current));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [setPreviewSize]);

  const handleMarqueeMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    const container = contentRef.current;
    if (!container || e.button !== 0) return;
    const target = e.target as HTMLElement;
    // clique em item, botão, cabeçalho da lista etc. não inicia caixa
    if (target.closest('[data-entry-path], button, input, textarea, select, a, thead, [data-no-marquee]')) return;
    // clique na barra de rolagem de um elemento (offset além da área útil) também não
    if (e.nativeEvent.offsetX > target.clientWidth || e.nativeEvent.offsetY > target.clientHeight) return;
    // sem itens marcados com `data-entry-path` na tela (vazio, ou grid/lista ainda sem o atributo): sem caixa
    if (!container.querySelector('[data-entry-path]')) return;

    const bounds = container.getBoundingClientRect();
    const clampX = (x: number) => Math.min(Math.max(x, bounds.left), bounds.right);
    const clampY = (y: number) => Math.min(Math.max(y, bounds.top), bounds.bottom);
    const originX = e.clientX;
    const originY = e.clientY;
    const startX = clampX(originX);
    const startY = clampY(originY);
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
    const base = additive ? Array.from(selectedPaths) : [];
    let moved = false;
    let lastKey = '';
    let lastEvent: MouseEvent | null = null;
    let frame = 0;

    e.preventDefault(); // evita selecionar texto da página durante o arraste

    const update = () => {
      frame = 0;
      if (!lastEvent) return;
      const x = clampX(lastEvent.clientX);
      const y = clampY(lastEvent.clientY);
      const left = Math.min(startX, x);
      const top = Math.min(startY, y);
      const right = Math.max(startX, x);
      const bottom = Math.max(startY, y);
      setMarqueeRect({ left, top, width: right - left, height: bottom - top });

      const hits: string[] = [];
      container.querySelectorAll<HTMLElement>('[data-entry-path]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right >= left && r.left <= right && r.bottom >= top && r.top <= bottom && el.dataset.entryPath) {
          hits.push(el.dataset.entryPath);
        }
      });
      const key = hits.join('\n');
      if (key === lastKey) return; // mesma seleção de antes: não re-renderiza à toa
      lastKey = key;
      selectPaths([...base, ...hits]);
    };

    const onMove = (ev: MouseEvent) => {
      if (!moved) {
        if (Math.hypot(ev.clientX - originX, ev.clientY - originY) < 4) return; // ainda é um clique
        moved = true;
      }
      lastEvent = ev;
      if (!frame) frame = requestAnimationFrame(update);
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (frame) cancelAnimationFrame(frame);
      marqueeCleanupRef.current = null;
    };

    const onUp = () => {
      if (frame) { cancelAnimationFrame(frame); update(); }
      cleanup();
      setMarqueeRect(null);
      if (moved) {
        // o `click` que o navegador dispara logo após soltar não pode limpar a seleção recém-feita
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, 0);
      }
    };

    marqueeCleanupRef.current = cleanup;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ---- Arrastar itens selecionados pra mover / lixeira / excluir de vez ----
  // Feito com eventos de mouse (não com o drag-and-drop HTML5): no Tauri/Windows o drag nativo da
  // janela intercepta o HTML5 e os eventos nem chegam na página. O arraste só começa de um item que
  // JÁ está selecionado (mousedown num item não selecionado continua sendo "arrastar pra selecionar").
  // Alvos: `data-drop-path` (pasta) e `data-drop-zone="trash" | "permanent"`.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [moveDrag, setMoveDrag] = useState<{ count: number; zone: 'trash' | 'permanent' | null; nearTrash: boolean } | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const ghostPosRef = useRef({ x: 0, y: 0 });
  const moveDragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => moveDragCleanupRef.current?.(), []);

  const findEntryByPath = (path: string): FsEntry | null => {
    const inRoot = entries.find((it) => it.path === path);
    if (inRoot) return inRoot;
    for (const list of Object.values(columnEntries)) {
      const found = list.find((it) => it.path === path);
      if (found) return found;
    }
    return null;
  };

  const canDropInto = (list: FsEntry[], dest: string): boolean => {
    if (list.every((it) => samePath(dirname(it.path), dest))) return false; // já estão lá
    return !list.some((it) => {
      if (!it.isDir) return false;
      const sep = it.path.includes('\\') ? '\\' : '/';
      // não dá pra soltar uma pasta nela mesma nem dentro de uma subpasta dela
      return samePath(it.path, dest) || dest.toLowerCase().startsWith(it.path.toLowerCase() + sep);
    });
  };

  const startMoveDrag = (grabbed: FsEntry, startEvent: ReactMouseEvent) => {
    const originX = startEvent.clientX;
    const originY = startEvent.clientY;
    let active = false;
    let list: FsEntry[] = [];
    let target: { kind: 'folder'; path: string } | { kind: 'group'; id: string } | { kind: 'trash' } | { kind: 'permanent' } | null = null;
    let hoverEl: HTMLElement | null = null;
    let shown = { count: -1, zone: null as 'trash' | 'permanent' | null, nearTrash: false };
    let lastEvent: MouseEvent | null = null;
    let frame = 0;

    const setHover = (el: HTMLElement | null) => {
      if (hoverEl === el) return;
      hoverEl?.removeAttribute('data-drop-hover');
      hoverEl = el;
      el?.setAttribute('data-drop-hover', 'true');
    };

    const update = () => {
      frame = 0;
      const ev = lastEvent;
      if (!ev) return;
      ghostPosRef.current = { x: ev.clientX, y: ev.clientY };
      if (ghostRef.current) ghostRef.current.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 14}px)`;

      const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const zoneEl = under?.closest('[data-drop-zone]') as HTMLElement | null;
      const dropEl = under?.closest('[data-drop-path]') as HTMLElement | null;
      const groupEl = under?.closest('[data-drop-group]') as HTMLElement | null;
      if (zoneEl) {
        target = zoneEl.dataset.dropZone === 'permanent' ? { kind: 'permanent' } : { kind: 'trash' };
        setHover(null);
      } else if (dropEl?.dataset.dropPath && canDropInto(list, dropEl.dataset.dropPath)) {
        target = { kind: 'folder', path: dropEl.dataset.dropPath };
        setHover(dropEl);
      } else if (groupEl?.dataset.dropGroup && list.some((it) => it.isDir)) {
        // pastas arrastadas até um grupo da sidebar: vira atalho dentro dele (nada é movido)
        target = { kind: 'group', id: groupEl.dataset.dropGroup };
        setHover(groupEl);
      } else {
        target = null;
        setHover(null);
      }

      // o ícone de "excluir permanentemente" só aparece quando o mouse chega perto da lixeira
      let near = target?.kind === 'permanent';
      const trashEl = document.querySelector('[data-trash-anchor]');
      if (trashEl && !near) {
        const r = trashEl.getBoundingClientRect();
        near = Math.hypot(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2)) < 220;
      }
      const zone = target && (target.kind === 'trash' || target.kind === 'permanent') ? target.kind : null;
      if (shown.count !== list.length || shown.zone !== zone || shown.nearTrash !== near) {
        shown = { count: list.length, zone, nearTrash: near };
        setMoveDrag({ count: list.length, zone, nearTrash: near });
      }
    };

    const onMove = (ev: MouseEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - originX, ev.clientY - originY) < 5) return; // ainda é um clique
        active = true;
        list = entriesForAction(grabbed);
        ghostPosRef.current = { x: ev.clientX, y: ev.clientY };
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
      }
      // Saiu da janela (ou encostou na borda dela, caso esteja maximizada): o arraste vira um arraste
      // nativo do sistema, pra soltar em outro programa ou no Explorer, igual o gerenciador de arquivos.
      if (ev.clientX <= 1 || ev.clientY <= 1 || ev.clientX >= window.innerWidth - 2 || ev.clientY >= window.innerHeight - 2) {
        const items = list;
        cleanup(); // encerra o arraste interno sem soltar nada
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, 0);
        startSystemDrag(items);
        return;
      }
      lastEvent = ev;
      if (!frame) frame = requestAnimationFrame(update);
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKey, true);
      if (frame) cancelAnimationFrame(frame);
      setHover(null);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setMoveDrag(null);
      moveDragCleanupRef.current = null;
    };

    const onUp = () => {
      if (frame) { cancelAnimationFrame(frame); update(); }
      const wasActive = active;
      const finalTarget = target;
      const items = list;
      cleanup();
      if (!wasActive) return; // foi só um clique
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 0);
      if (!finalTarget) return;
      if (finalTarget.kind === 'folder') moveEntries(items, finalTarget.path);
      else if (finalTarget.kind === 'group') addFoldersToGroup(finalTarget.id, items.filter((it) => it.isDir).map((it) => it.path));
      else if (finalTarget.kind === 'trash') removeEntries(items, 'trash'); // sem confirmação
      else setPermanentDeleting(items); // exclusão de vez: pede confirmação
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation(); // Esc cancela só o arraste (não limpa a seleção)
      cleanup();
    };

    moveDragCleanupRef.current = cleanup;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey, true);
  };

  // Arrastar pra selecionar: solta o botão do mouse em qualquer lugar (não só em cima de
  // um item) encerra o arraste — daí o listener no window, não num elemento específico.
  useEffect(() => {
    window.addEventListener('mouseup', endDragSelection);
    return () => window.removeEventListener('mouseup', endDragSelection);
  }, [endDragSelection]);

  useEffect(() => {
    function findColumnLevel(path: string): number {
      for (let i = 0; i < columnPaths.length; i++) {
        const list = i === 0 ? entries : (columnEntries[columnPaths[i]] ?? []);
        if (list.some((e) => e.path === path)) return i;
      }
      return -1;
    }

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      // Space em botão/link/select com foco já tem função nativa (clicar) — não pode
      // disparar o QuickLook junto
      const isActivatable =
        target.tagName === 'BUTTON' || target.tagName === 'SELECT' || target.tagName === 'A' ||
        target.getAttribute('role') === 'button';

      if (quickLookOpen) {
        // Space fecha o QuickLook, mas não enquanto o usuário está digitando no textarea de
        // edição nem com foco num botão (ex: "Salvar"). `repeat` ignora o auto-repeat de
        // segurar a tecla, que abriria e fecharia o modal em sequência.
        if (!isTyping && !isActivatable && e.key === ' ') {
          e.preventDefault();
          if (!e.repeat) closeQuickLook();
        }
        return;
      }

      if (isTyping || viewingTrash || permanentDeleting) return;

      // Esc: limpa a seleção múltipla (não faz nada se só tem um item selecionado, ou nenhum)
      if (e.key === 'Escape' && selectedPaths.size > 0) {
        e.preventDefault();
        clearSelection();
        return;
      }

      // Ctrl/Cmd+A seleciona tudo; Ctrl/Cmd+C / X / V copiam, recortam e colam a seleção inteira
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        const k = e.key.toLowerCase();
        if (k === 'a') {
          e.preventDefault();
          if (viewMode === 'columns') {
            const level = selectedEntry ? findColumnLevel(selectedEntry.path) : 0;
            const list = level <= 0 ? entries : (columnEntries[columnPaths[level]] ?? []);
            selectPaths(list.map((it) => it.path));
          } else {
            selectAll();
          }
          return;
        }
        if (k === 'c' && selectedEntry) { e.preventDefault(); copyEntry(selectedEntry); return; }
        if (k === 'x' && selectedEntry) { e.preventDefault(); cutEntry(selectedEntry); return; }
        if (k === 'v' && clipboard) { e.preventDefault(); pasteClipboard(); return; }
      }

      // "Shift+R" atualiza a listagem. NÃO usa Ctrl+R de propósito: esse é o atalho do WebView pra recarregar o app.
      // Vem antes do "r" porque o handler de desfazer não olha o Shift.
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (!e.repeat) refresh();
        return;
      }

      // "r" desfaz a última ação; "Alt+R" refaz (log na coluna Histórico). Alt+R checa `e.code` por causa do macOS.
      const isR = e.key.toLowerCase() === 'r' || (e.altKey && e.code === 'KeyR');
      if (isR && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (!e.repeat) { if (e.altKey) redo(); else undo(); }
        return;
      }

      // "f" cria pasta, "e" cria arquivo (abrem o modal de nome, na pasta atual)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key.toLowerCase() === NEW_FOLDER_KEY || e.key.toLowerCase() === NEW_FILE_KEY)) {
        e.preventDefault();
        if (!e.repeat && currentPath) {
          if (e.key.toLowerCase() === NEW_FOLDER_KEY) setCreateFolderOpen(true);
          else setCreateFileOpen(true);
        }
        return;
      }

      // "q": manda pra lixeira SEM confirmação; "Alt+Q": exclusão permanente, pedindo confirmação.
      // Funciona em qualquer modo e afeta a seleção múltipla inteira se o item atual fizer parte
      // dela. Alt+Q checa também `e.code`, porque no macOS Alt+Q gera outro caractere em `e.key`.
      const isQ = e.key.toLowerCase() === 'q' || (e.altKey && e.code === 'KeyQ');
      if (isQ && !e.ctrlKey && !e.metaKey && selectedEntry) {
        e.preventDefault();
        if (e.repeat) return; // segurar a tecla não pode excluir em sequência
        const targets = entriesForAction(selectedEntry);
        if (e.altKey) setPermanentDeleting(targets);
        else removeEntries(targets, 'trash');
        return;
      }

      // Space: abre o QuickLook — funciona em qualquer modo, inclusive ícones
      if (e.key === ' ' && selectedEntry && !isActivatable) {
        e.preventDefault();
        if (!e.repeat) openQuickLook();
        return;
      }

      if (viewMode === 'icons') {
        if (!selectedEntry) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          openEntry(selectedEntry);
        } else if (e.key === 'Delete') {
          e.preventDefault();
          goUp();
        }
        return;
      }

      // lista e colunas: w/s navegam, a fecha, d abre
      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        moveSelectionVertical(-1);
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        moveSelectionVertical(1);
        return;
      }

      if (!selectedEntry) return;

      if (viewMode === 'list') {
        if (!selectedEntry.isDir) return;
        if ((e.key === 'a' || e.key === 'A') && expandedPaths.has(selectedEntry.path)) {
          e.preventDefault();
          toggleExpand(selectedEntry.path);
        } else if ((e.key === 'd' || e.key === 'D') && !expandedPaths.has(selectedEntry.path)) {
          e.preventDefault();
          toggleExpand(selectedEntry.path);
        }
        return;
      }

      if (viewMode === 'columns') {
        const levelIndex = findColumnLevel(selectedEntry.path);
        if (levelIndex === -1) return;

        // "a": sempre move o foco pra coluna anterior (lateral esquerda), mesmo
        // se o item selecionado for um arquivo — não fecha nada na raiz (nível 0).
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          collapseToParentColumn(levelIndex);
          return;
        }

        // "d": só em pastas — abre (ou reaproveita) a coluna seguinte e move o
        // foco pra ela, permitindo continuar navegando com w/s do lado de lá.
        if ((e.key === 'd' || e.key === 'D') && selectedEntry.isDir) {
          e.preventDefault();
          expandColumnAndFocus(levelIndex, selectedEntry);
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedEntry, permanentDeleting, viewingTrash, viewMode, removeEntries,
    entries, columnPaths, columnEntries, expandedPaths,
    openEntry, goUp, toggleExpand, expandColumn, expandColumnAndFocus, collapseToParentColumn, moveSelectionVertical,
    quickLookOpen, openQuickLook, closeQuickLook,
    selectedPaths, clearSelection, entriesForAction,
    selectPaths, selectAll, copyEntry, cutEntry, pasteClipboard, clipboard, undo, redo, refresh, currentPath,
  ]);

  if (initializing) {
    return <p className={`p-6 ${MUTED}`}>Iniciando o Explorador...</p>;
  }

  return (
    <div className="flex h-full flex-col bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      <ExplorerToolbar store={store} />

      <div className="flex min-h-0 flex-1">
        <ExplorerSidebar
          locations={quickAccess}
          currentPath={currentPath}
          onNavigate={navigateTo}
          onOpenTrash={openTrash}
          viewingTrash={viewingTrash}
          groups={folderGroups}
          onCreateGroup={() => setGroupModal({ group: null })}
          onRenameGroup={(group) => setGroupModal({ group })}
          onDeleteGroup={setDeletingGroup}
          onToggleGroup={toggleGroupCollapsed}
          onRemoveFromGroup={removeFolderFromGroup}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {currentPath && (
            <div className="flex items-center">
              <div className="min-w-0 flex-1">
                <ExplorerBreadcrumb path={currentPath} onNavigate={navigateTo} />
              </div>
              <button
                title="Abrir esta pasta no explorador do sistema"
                onClick={(e) => {
                  e.currentTarget.blur(); // senão o foco fica no botão e o Space (QuickLook) clicaria nele de novo
                  openCurrentFolderInSystem();
                }}
                className={`${BTN} mx-3`}
              >
                <MdOpenInNew size={14} /> Abrir no sistema
              </button>
              <button
                title="Mostrar/ocultar o histórico de ações"
                onClick={(e) => { e.currentTarget.blur(); setHistoryOpen((v) => !v); }}
                className={`${BTN} mr-3 ${historyOpen ? '!bg-blue-100 dark:!bg-blue-500/25' : ''}`}
              >
                <MdHistory size={14} /> Histórico
              </button>
              <button
                title="Abrir o Explorador numa janela separada (sem aside e abas)"
                onClick={(e) => { e.currentTarget.blur(); openInNewWindow(); }}
                className={`${BTN} mr-3`}
              >
                <MdLaunch size={14} /> Nova janela
              </button>
            </div>
          )}

          {error && <p className="px-4 py-2 text-[13px] text-red-600 dark:text-red-400">{error}</p>}

          <div
            ref={contentRef}
            data-drop-path={viewMode !== 'columns' && currentPath ? currentPath : undefined}
            className={`flex-1 overflow-y-auto ${marqueeRect ? 'select-none' : ''}`}
            onMouseDown={handleMarqueeMouseDown}
            // clicar na área de arquivos tira o foco de um botão da toolbar; sem isso o foco
            // ficava preso nele e o Space (que respeita botões focados) nunca abria o QuickLook
            onMouseDownCapture={(e) => {
              const itemEl = (e.target as HTMLElement).closest('[data-entry-path]') as HTMLElement | null;
              downOnItemRef.current = !!itemEl;
              if (itemEl && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !(e.target as HTMLElement).closest('button')) {
                const grabbedPath = itemEl.dataset.entryPath;
                if (grabbedPath && selectedPaths.has(grabbedPath)) {
                  const grabbed = findEntryByPath(grabbedPath);
                  if (grabbed) startMoveDrag(grabbed, e);
                }
              }
              const active = document.activeElement;
              if (active instanceof HTMLElement && active.tagName === 'BUTTON') active.blur();
            }}
            onClick={(e) => {
              // a caixa de seleção acabou de soltar: o click que vem junto não pode apagar o resultado
              if (suppressClickRef.current) return;
              // soltou depois de arrastar a partir de um item (seleção por arraste): mantém o que foi selecionado
              if (downOnItemRef.current) return;
              // só limpa a seleção se o clique não foi capturado por um item (que já dá preventDefault)
              if (e.defaultPrevented) return;
              // Ctrl/Cmd/Shift + clique em espaço vazio não derruba a seleção
              if (e.ctrlKey || e.metaKey || e.shiftKey) return;
              clearSelection();
            }}
            onContextMenu={(e) => {
              // só abre o menu de "área vazia" se o clique não foi capturado por um item (que já dá preventDefault + para a propagação via handler próprio)
              if (e.defaultPrevented) return;
              e.preventDefault();
              setEmptyAreaMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            {viewMode === 'columns' ? (
              <div className="flex h-full overflow-x-auto">
                {columnPaths.map((path, levelIndex) => {
                  const list = levelIndex === 0 ? entries : (columnEntries[path] ?? []);
                  const isLoadingColumn = levelIndex === 0 ? loading : !!columnLoading[path];
                  const nextPath = columnPaths[levelIndex + 1];

                  return (
                    <div key={path} className={`w-[220px] min-w-[220px] overflow-y-auto border-r ${BORDER}`}>
                      {isLoadingColumn ? (
                        <p className={`p-4 text-[13px] ${MUTED}`}>Carregando...</p>
                      ) : list.length === 0 ? (
                        <p className={`p-4 text-[13px] ${MUTED}`}>Pasta vazia.</p>
                      ) : (
                        list.map((entry) => {
                          const active = entry.path === nextPath || selectedPaths.has(entry.path);
                          return (
                            <div
                              key={entry.path}
                              data-entry-path={entry.path}
                              data-drop-path={entry.isDir ? entry.path : undefined}
                              onClick={(e) => {
                                e.preventDefault();
                                if (e.ctrlKey || e.metaKey || e.shiftKey) {
                                  selectWithModifiers(entry.path, e, list.map((it) => it.path));
                                } else {
                                  expandColumn(levelIndex, entry);
                                }
                              }}
                              onMouseDown={(e) => {
                                if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                                  e.preventDefault();
                                  if (!selectedPaths.has(entry.path)) startDragSelection(entry.path, list.map((it) => it.path));
                                }
                              }}
                              onMouseEnter={() => extendDragSelection(entry.path)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                if (!selectedPaths.has(entry.path)) {
                                  selectWithModifiers(entry.path, { ctrlKey: false, metaKey: false, shiftKey: false });
                                }
                                setEntryMenu({ x: e.clientX, y: e.clientY, entry });
                              }}
                              className={`flex cursor-default items-center gap-2 px-2.5 py-1.5 text-[13px] ${active ? SELECTED_BG : ''}`}
                            >
                              <ExplorerThumbnail
                                entry={entry}
                                size={previewSize}
                                customIconPath={entry.isDir ? folderIcons[entry.path] : undefined}
                              />
                              <span className="flex-1 truncate">
                                {entry.name}
                              </span>
                              {entry.isDir && <MdChevronRight size={14} className="text-zinc-400" />}
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            ) : loading ? (
              <p className={`p-6 text-[13px] ${MUTED}`}>Carregando...</p>
            ) : entries.length === 0 ? (
              <div className={`py-16 text-center ${MUTED}`}>
                <p className="text-sm">Esta pasta está vazia.</p>
              </div>
            ) : viewMode === 'icons' ? (
              <ExplorerFileGrid
                entries={entries}
                selectedPaths={selectedPaths}
                onSelect={(entry, e) => selectWithModifiers(entry.path, e)}
                onOpen={openEntry}
                onContextMenu={(e, entry) => {
                  e.preventDefault();
                  if (!selectedPaths.has(entry.path)) {
                    selectWithModifiers(entry.path, { ctrlKey: false, metaKey: false, shiftKey: false });
                  }
                  setEntryMenu({ x: e.clientX, y: e.clientY, entry });
                }}
                thumbnailSize={previewSize}
                folderIcons={folderIcons}
                onSelectDragStart={(entry) => { if (!selectedPaths.has(entry.path)) startDragSelection(entry.path); }}
                onSelectDragOver={(entry) => extendDragSelection(entry.path)}
              />
            ) : (
              <ExplorerFileList
                entries={entries}
                selectedPaths={selectedPaths}
                onSelect={(entry, e) => selectWithModifiers(entry.path, e)}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                onOpen={openEntry}
                onContextMenu={(e, entry) => {
                  e.preventDefault();
                  if (!selectedPaths.has(entry.path)) {
                    selectWithModifiers(entry.path, { ctrlKey: false, metaKey: false, shiftKey: false });
                  }
                  setEntryMenu({ x: e.clientX, y: e.clientY, entry });
                }}
                expandedPaths={expandedPaths}
                childrenByPath={columnEntries}
                childrenLoading={columnLoading}
                onToggleExpand={toggleExpand}
                thumbnailSize={previewSize}
                folderIcons={folderIcons}
                onSelectDragStart={(entry) => { if (!selectedPaths.has(entry.path)) startDragSelection(entry.path); }}
                onSelectDragOver={(entry) => extendDragSelection(entry.path)}
              />
            )}
          </div>

          <ExplorerStatusBar itemCount={itemCount} totalSize={totalSize} />
        </div>
        {historyOpen && (
          <div className={`flex min-h-0 w-[260px] flex-col border-l ${BORDER}`}>
            <div className={`border-b px-3 py-2.5 ${BORDER}`}>
              <div className="mb-2 text-[13px] font-semibold">Histórico</div>
              <div className="flex gap-1.5">
                <button
                  disabled={!canUndo}
                  title="Desfazer (R)"
                  onClick={(e) => { e.currentTarget.blur(); undo(); }}
                  className={`${BTN} ${canUndo ? '' : 'opacity-40'}`}
                >
                  <MdUndo size={14} /> Desfazer (R)
                </button>
                <button
                  disabled={!canRedo}
                  title="Refazer (Alt+R)"
                  onClick={(e) => { e.currentTarget.blur(); redo(); }}
                  className={`${BTN} ${canRedo ? '' : 'opacity-40'}`}
                >
                  <MdRedo size={14} /> Refazer (Alt+R)
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {history.length === 0 ? (
                <p className={`p-3 text-xs ${MUTED}`}>Nenhuma ação ainda.</p>
              ) : (
                [...history].reverse().map((h) => (
                  <div
                    key={h.id}
                    className={`border-b border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800 ${h.undone ? 'opacity-50' : ''}`}
                  >
                    <div className={`break-words ${h.undone ? 'line-through' : ''}`}>{h.label}</div>
                    <div className={`text-[11px] ${MUTED}`}>
                      {new Date(h.at).toLocaleTimeString()}
                      {!isReversible(h.action) ? ' · não reversível' : h.undone ? ' · desfeita' : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className={`w-[240px] overflow-y-auto border-l p-4 ${BORDER}`}>
          {selectedEntry ? (
            <div className="flex flex-col items-center gap-3">
              <ExplorerThumbnail
                entry={selectedEntry}
                size={240}
                customIconPath={selectedEntry.isDir ? folderIcons[selectedEntry.path] : undefined}
              />
              <p className="m-0 break-words text-center text-[13px] font-semibold">
                {selectedEntry.name}
              </p>
              <div className={`flex w-full flex-col gap-1 text-xs ${MUTED}`}>
                <span>{selectedEntry.isDir ? 'Pasta' : (selectedEntry.extension ?? 'Arquivo')}</span>
                {!selectedEntry.isDir && <span>{formatBytes(selectedEntry.size)}</span>}
                <span>Modificado: {formatModifiedDate(selectedEntry.modifiedAt)}</span>
              </div>

              {folderPreview && folderPreview.path === selectedEntry.path && (
                <div className={`w-full border-t pt-3 ${BORDER}`}>
                  <div className={`mb-2 text-[11px] uppercase ${MUTED}`}>
                    {folderPreview.loading && folderPreview.entries.length === 0
                      ? 'Carregando...'
                      : `${folderPreview.entries.length} ${folderPreview.entries.length === 1 ? 'item' : 'itens'}`}
                  </div>
                  {folderPreview.error ? (
                    <p className="text-xs text-red-600 dark:text-red-400">{folderPreview.error}</p>
                  ) : !folderPreview.loading && folderPreview.entries.length === 0 ? (
                    <p className={`text-xs ${MUTED}`}>Pasta vazia.</p>
                  ) : (
                    <>
                      {/* ícones maiores em grade; o tamanho acompanha o slider de preview da toolbar (mínimo 48px) */}
                      <ul
                        className="m-0 grid list-none gap-1 p-0"
                        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(previewSize, 48) + 8}px, 1fr))` }}
                      >
                        {folderPreview.entries.slice(0, PREVIEW_LIST_LIMIT).map((child) => (
                          <li key={child.path} className="flex min-w-0 flex-col items-center gap-1 text-center text-[11px]" title={child.name}>
                            <PreviewTile
                              entry={child}
                              size={Math.max(previewSize, 48)}
                              customIconPath={child.isDir ? folderIcons[child.path] : undefined}
                            />
                            <span className="w-full truncate">{child.name}</span>
                          </li>
                        ))}
                      </ul>
                      {folderPreview.entries.length > PREVIEW_LIST_LIMIT && (
                        <p className={`pt-2 text-xs ${MUTED}`}>
                          + {folderPreview.entries.length - PREVIEW_LIST_LIMIT} itens
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className={`mt-8 text-center text-[13px] ${MUTED}`}>
              Selecione um arquivo pra ver o preview
            </p>
          )}
        </div>
      </div>

      {entryMenu && (
        <ContextMenu
          x={entryMenu.x}
          y={entryMenu.y}
          items={entryContextItems(entryMenu.entry)}
          onClose={() => setEntryMenu(null)}
        />
      )}

      {emptyAreaMenu && (
        <ContextMenu
          x={emptyAreaMenu.x}
          y={emptyAreaMenu.y}
          items={emptyAreaItems}
          onClose={() => setEmptyAreaMenu(null)}
        />
      )}

      <style>{`
        [data-drop-hover="true"] { outline: 2px solid #2563eb; outline-offset: -2px; background: #dbeafe !important; }
        .dark [data-drop-hover="true"] { outline-color: #60a5fa; background: rgba(59, 130, 246, 0.3) !important; }
      `}</style>

      {moveDrag && (
        <>
          <div
            ref={ghostRef}
            className="pointer-events-none fixed left-0 top-0 z-[70] rounded-full bg-blue-600 px-2.5 py-1 text-xs text-white will-change-transform"
            style={{ transform: `translate(${ghostPosRef.current.x + 14}px, ${ghostPosRef.current.y + 14}px)` }}
          >
            {moveDrag.count === 1 ? '1 item' : `${moveDrag.count} itens`}
          </div>

          <div
            data-drop-zone="trash"
            data-trash-anchor
            className={`fixed bottom-14 right-7 z-[60] flex h-[76px] w-[76px] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-dashed text-center text-[11px] shadow-lg transition-transform ${
              moveDrag.zone === 'trash'
                ? 'scale-110 border-red-600 bg-red-50 text-red-600 dark:border-red-400 dark:bg-red-950 dark:text-red-300'
                : 'border-zinc-400 bg-white text-zinc-600 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            <MdDelete size={28} />
            Lixeira
          </div>

          {moveDrag.nearTrash && (
            <div
              data-drop-zone="permanent"
              className={`fixed bottom-14 right-[120px] z-[60] flex h-[76px] w-[76px] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-red-600 text-center text-[11px] shadow-lg transition-transform dark:border-red-400 ${
                moveDrag.zone === 'permanent'
                  ? 'scale-110 bg-red-600 text-white dark:bg-red-500'
                  : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300'
              }`}
            >
              <MdDeleteForever size={28} />
              Excluir de vez
            </div>
          )}
        </>
      )}

      {marqueeRect && (
        <div
          className="pointer-events-none fixed z-50 border border-blue-600 bg-blue-600/[0.15] dark:border-blue-400 dark:bg-blue-400/20"
          style={{ left: marqueeRect.left, top: marqueeRect.top, width: marqueeRect.width, height: marqueeRect.height }}
        />
      )}

      {viewingTrash && (
        <Modal open={viewingTrash} onClose={closeTrash}>
          <div className="max-h-[70vh] w-[560px] max-w-[90vw] overflow-y-auto p-1">
            <h2 className="mb-3 text-[15px] font-semibold">🗑️ Lixeira</h2>
            {trashLoading ? (
              <p className={`text-[13px] ${MUTED}`}>Carregando lixeira...</p>
            ) : trashError ? (
              <p className="text-[13px] text-red-600 dark:text-red-400">{trashError}</p>
            ) : trashItems.length === 0 ? (
              <p className={`text-[13px] ${MUTED}`}>A lixeira está vazia.</p>
            ) : (
              trashItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 border-b border-zinc-100 px-1 py-2 text-[13px] dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <div className="truncate">{item.name}</div>
                    <div className={`break-all text-[11px] ${MUTED}`}>Origem: {item.originalParent}</div>
                  </div>
                  <button
                    onClick={() => restoreFromTrash(item)}
                    className="shrink-0 rounded-md border border-blue-600 bg-white px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:bg-transparent dark:text-blue-300 dark:hover:bg-blue-500/20"
                  >
                    Restaurar
                  </button>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {quickLookOpen && selectedEntry && (
        <Modal open={quickLookOpen} onClose={closeQuickLook}>
          <QuickLookContent
            entry={selectedEntry}
            readQuickLookText={readQuickLookText}
            saveQuickLookText={saveQuickLookText}
          />
        </Modal>
      )}

      <NamePromptModal
        open={createFolderOpen}
        title="Nova pasta"
        confirmLabel="Criar"
        onClose={() => setCreateFolderOpen(false)}
        onSubmit={(name) => createFolder(name)}
      />

      <NamePromptModal
        open={createFileOpen}
        title="Novo arquivo (com extensão, ex: notas.txt)"
        confirmLabel="Criar"
        onClose={() => setCreateFileOpen(false)}
        onSubmit={(name) => createFile(name)}
      />

      <NamePromptModal
        open={!!renamingEntry}
        title="Renomear"
        initialValue={renamingEntry?.name}
        confirmLabel="Renomear"
        onClose={() => setRenamingEntry(null)}
        onSubmit={(name) => rename(renamingEntry!, name)}
      />

      <NamePromptModal
        open={!!groupModal}
        title={groupModal?.group ? 'Renomear grupo' : 'Novo grupo'}
        initialValue={groupModal?.group?.name}
        confirmLabel={groupModal?.group ? 'Renomear' : 'Criar'}
        onClose={() => setGroupModal(null)}
        onSubmit={async (name) => {
          if (groupModal?.group) renameGroup(groupModal.group.id, name);
          else createGroup(name);
        }}
      />

      <ConfirmDialog
        isOpen={!!deletingGroup}
        title="Excluir grupo"
        message={`Excluir o grupo "${deletingGroup?.name}"? Só os atalhos somem; as pastas continuam onde estão.`}
        onConfirm={() => {
          if (deletingGroup) deleteGroup(deletingGroup.id);
          setDeletingGroup(null);
        }}
        onCancel={() => setDeletingGroup(null)}
      />

      <ConfirmDialog
        isOpen={!!permanentDeleting}
        title="Excluir permanentemente"
        message={
          permanentDeleting && permanentDeleting.length > 1
            ? `Excluir ${permanentDeleting.length} itens PERMANENTEMENTE? Isso não pode ser desfeito e eles não vão para a lixeira.`
            : `Excluir "${permanentDeleting?.[0]?.name}" PERMANENTEMENTE? Isso não pode ser desfeito e o item não vai para a lixeira.`
        }
        onConfirm={async () => {
          const list = permanentDeleting;
          setPermanentDeleting(null);
          if (list) await removeEntries(list, 'permanent');
        }}
        onCancel={() => setPermanentDeleting(null)}
      />
    </div>
  );
}
