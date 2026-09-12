import { CSSProperties, useEffect, useState } from 'react';
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
import ExplorerThumbnail from './components/ExplorerThumbnail';
import { formatBytes, formatModifiedDate } from './utils/formatters';
import { getMediaKind, isTextFile } from '@/FileExplorer/utils/mediaType';

import { MdChevronRight } from 'react-icons/md';
import { convertFileSrc } from '@tauri-apps/api/core';
import Modal from '@/components/ui/Modal';

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
          <div className="quicklook-error">{textError}</div>
        </div>
      );
    }
    if (text === null) {
      return (
        <div style={baseContainerStyle}>
          <div className="quicklook-loading">Carregando...</div>
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
          className="quicklook-textarea"
          style={{
            flex: 1,
            width: '100%',
            resize: 'none',
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: 13,
            boxSizing: 'border-box',
          }}
        />
        <button onClick={handleSave} disabled={saving} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    );
  }

  return (
    <div style={baseContainerStyle}>
      <div className="quicklook-unsupported">
        Prévia não suportada para este tipo de arquivo.
      </div>
    </div>
  );
}

export default function FileExplorerPage() {
  const store = useFileExplorerStore();
  const {
    currentPath, entries, loading, initializing, error,
    navigateTo, refresh, openEntry, quickAccess,
    sortField, sortDirection, setSortField, setSortDirection, viewMode,
    createFolder, rename, removeEntry,
    clipboard, copyEntry, cutEntry, pasteClipboard,
    selectedEntry, select,
    itemCount, totalSize,
    columnPaths, columnEntries, columnLoading, expandColumn, closeColumnAt, goUp, moveSelectionVertical,
    previewSize,
    viewingTrash, openTrash, restoreFromTrash, trashItems, trashLoading, trashError,
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
  const [renamingEntry, setRenamingEntry] = useState<FsEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<FsEntry | null>(null);

  const handleSort = (field: typeof sortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const entryContextItems = (entry: FsEntry): ContextMenuItem[] => [
    { label: entry.isDir ? 'Abrir' : 'Abrir com app padrão', onClick: () => openEntry(entry) },
    { label: 'Renomear', onClick: () => setRenamingEntry(entry) },
    { label: 'Copiar', onClick: () => copyEntry(entry) },
    { label: 'Recortar', onClick: () => cutEntry(entry) },
    { label: 'Excluir', danger: true, onClick: () => setDeletingEntry(entry) },
  ];

  const emptyAreaItems: ContextMenuItem[] = [
    { label: 'Nova pasta', onClick: () => setCreateFolderOpen(true) },
    { label: 'Colar', onClick: () => pasteClipboard(), disabled: !clipboard },
    { label: 'Atualizar', onClick: () => refresh() },
  ];


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

      if (quickLookOpen) {
        // Space fecha o QuickLook, mas não enquanto o usuário está digitando no textarea de edição
        if (!isTyping && e.key === ' ') {
          e.preventDefault();
          closeQuickLook();
        }
        return;
      }

      if (isTyping || viewingTrash) return;

      // "q": pede confirmação de exclusão (lixeira) — funciona em qualquer modo
      if ((e.key === 'q' || e.key === 'Q') && selectedEntry && !deletingEntry) {
        e.preventDefault();
        setDeletingEntry(selectedEntry);
        return;
      }

      // Space: abre o QuickLook — funciona em qualquer modo, inclusive ícones
      if (e.key === ' ' && selectedEntry) {
        e.preventDefault();
        openQuickLook();
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

      if (!selectedEntry || !selectedEntry.isDir) return;

      if (viewMode === 'list') {
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

        if ((e.key === 'a' || e.key === 'A') && columnPaths[levelIndex + 1] === selectedEntry.path) {
          e.preventDefault();
          closeColumnAt(levelIndex);
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          expandColumn(levelIndex, selectedEntry);
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedEntry, deletingEntry, viewingTrash, viewMode,
    entries, columnPaths, columnEntries, expandedPaths,
    openEntry, goUp, toggleExpand, expandColumn, closeColumnAt, moveSelectionVertical,
    quickLookOpen, openQuickLook, closeQuickLook
  ]);

  if (initializing) {
    return <p style={{ padding: 24, color: '#999' }}>Iniciando o Explorador...</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ExplorerToolbar store={store} />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <ExplorerSidebar
          locations={quickAccess}
          currentPath={currentPath}
          onNavigate={navigateTo}
          onOpenTrash={openTrash}
          viewingTrash={viewingTrash}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {currentPath && !viewingTrash && <ExplorerBreadcrumb path={currentPath} onNavigate={navigateTo} />}

          {error && <p style={{ padding: '8px 16px', color: '#d93025', fontSize: 13 }}>{error}</p>}

          <div
            style={{ flex: 1, overflowY: 'auto' }}
            onContextMenu={(e) => {
              // só abre o menu de "área vazia" se o clique não foi capturado por um item (que já dá preventDefault + para a propagação via handler próprio)
              if (e.defaultPrevented) return;
              e.preventDefault();
              setEmptyAreaMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            {viewingTrash ? (
              <div style={{ padding: 16, overflowY: 'auto', height: '100%' }}>
                <h2 style={{ fontSize: 15, marginBottom: 12 }}>🗑️ Lixeira</h2>
                {trashLoading ? (
                  <p style={{ color: '#999', fontSize: 13 }}>Carregando lixeira...</p>
                ) : trashError ? (
                  <p style={{ color: '#d93025', fontSize: 13 }}>{trashError}</p>
                ) : trashItems.length === 0 ? (
                  <p style={{ color: '#999', fontSize: 13 }}>A lixeira está vazia.</p>
                ) : (
                  trashItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 4px', borderBottom: '1px solid #f2f2f2', fontSize: 13,
                      }}
                    >
                      <div>
                        <div>{item.name}</div>
                        <div style={{ fontSize: 11, color: '#999' }}>Origem: {item.originalParent}</div>
                      </div>
                      <button
                        onClick={() => restoreFromTrash(item)}
                        style={{
                          border: '1px solid #1a73e8', color: '#1a73e8', background: '#fff',
                          borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        Restaurar
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : viewMode === 'columns' ? (
              <div style={{ display: 'flex', height: '100%', overflowX: 'auto' }}>
                {columnPaths.map((path, levelIndex) => {
                  const list = levelIndex === 0 ? entries : (columnEntries[path] ?? []);
                  const isLoadingColumn = levelIndex === 0 ? loading : !!columnLoading[path];
                  const nextPath = columnPaths[levelIndex + 1];

                  return (
                    <div key={path} style={{ width: 220, minWidth: 220, borderRight: '1px solid #e0e0e0', overflowY: 'auto' }}>
                      {isLoadingColumn ? (
                        <p style={{ padding: 16, color: '#999', fontSize: 13 }}>Carregando...</p>
                      ) : list.length === 0 ? (
                        <p style={{ padding: 16, color: '#999', fontSize: 13 }}>Pasta vazia.</p>
                      ) : (
                        list.map((entry) => {
                          const active = entry.path === nextPath || entry.path === selectedEntry?.path;
                          return (
                            <div
                              key={entry.path}
                              onClick={() => expandColumn(levelIndex, entry)}
                              onContextMenu={(e) => { e.preventDefault(); select(entry.path); setEntryMenu({ x: e.clientX, y: e.clientY, entry }); }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                                fontSize: 13, cursor: 'default', background: active ? '#e8f0fe' : 'transparent',
                              }}
                            >
                              <ExplorerThumbnail entry={entry} size={previewSize} />
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {entry.name}
                              </span>
                              {entry.isDir && <MdChevronRight size={14} color="#999" />}
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            ) : loading ? (
              <p style={{ padding: 24, color: '#999', fontSize: 13 }}>Carregando...</p>
            ) : entries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 0', color: '#999' }}>
                <p style={{ fontSize: 14 }}>Esta pasta está vazia.</p>
              </div>
            ) : viewMode === 'icons' ? (
              <ExplorerFileGrid
                entries={entries}
                selectedPath={selectedEntry?.path ?? null}
                onSelect={select}
                onOpen={openEntry}
                onContextMenu={(e, entry) => { e.preventDefault(); setEntryMenu({ x: e.clientX, y: e.clientY, entry }); }}
                thumbnailSize={previewSize}
              />
            ) : (
              <ExplorerFileList
                entries={entries}
                selectedPath={selectedEntry?.path ?? null}
                onSelect={select}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                onOpen={openEntry}
                onContextMenu={(e, entry) => { e.preventDefault(); setEntryMenu({ x: e.clientX, y: e.clientY, entry }); }}
                expandedPaths={expandedPaths}
                childrenByPath={columnEntries}
                childrenLoading={columnLoading}
                onToggleExpand={toggleExpand}
              />
            )}
          </div>

          {!viewingTrash && <ExplorerStatusBar itemCount={itemCount} totalSize={totalSize} />}
        </div>
        <div style={{ width: 240, borderLeft: '1px solid #e0e0e0', padding: 16, overflowY: 'auto' }}>
          {selectedEntry ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <ExplorerThumbnail entry={selectedEntry} size={240} />
              <p style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', wordBreak: 'break-word', margin: 0 }}>
                {selectedEntry.name}
              </p>
              <div style={{ width: '100%', fontSize: 12, color: '#666', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>{selectedEntry.isDir ? 'Pasta' : (selectedEntry.extension ?? 'Arquivo')}</span>
                {!selectedEntry.isDir && <span>{formatBytes(selectedEntry.size)}</span>}
                <span>Modificado: {formatModifiedDate(selectedEntry.modifiedAt)}</span>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#999', textAlign: 'center', marginTop: 32 }}>
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
        open={!!renamingEntry}
        title="Renomear"
        initialValue={renamingEntry?.name}
        confirmLabel="Renomear"
        onClose={() => setRenamingEntry(null)}
        onSubmit={(name) => rename(renamingEntry!, name)}
      />

      <ConfirmDialog
        isOpen={!!deletingEntry}
        title="Excluir"
        message={`Tem certeza que quer enviar "${deletingEntry?.name}" para a lixeira?`}
        onConfirm={async () => {
          if (deletingEntry) await removeEntry(deletingEntry);
          setDeletingEntry(null);
        }}
        onCancel={() => setDeletingEntry(null)}
      />
    </div>
  );
}
