import { useState, type CSSProperties } from 'react';
import { MdArrowBack, MdArrowForward, MdArrowUpward, MdSearch, MdMoreVert, MdRefresh, MdGridView, MdViewList, MdViewColumn } from 'react-icons/md';
import Tooltip from '@/components/ui/Tooltip';
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu';
import type { FileExplorerStore } from '../hooks/useFileExplorerStore';

interface ExplorerToolbarProps {
  store: FileExplorerStore;
}

export default function ExplorerToolbar({ store }: ExplorerToolbarProps) {
  const {
    canGoBack, canGoForward, canGoUp, goBack, goForward, goUp, refresh,
    search, setSearch, viewMode, setViewMode, setSortField,
    sortDirection, setSortDirection, setAsDefaultPath, defaultPath, currentPath,
    previewSize, setPreviewSize,
  } = store;

  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);

  const isDefaultPath = !!currentPath && currentPath === defaultPath;

  const menuItems: ContextMenuItem[] = [
    { label: 'Ordenar por nome', onClick: () => setSortField('name') },
    { label: 'Ordenar por tipo', onClick: () => setSortField('type') },
    { label: 'Ordenar por tamanho', onClick: () => setSortField('size') },
    { label: 'Ordenar por data', onClick: () => setSortField('date') },
    { label: sortDirection === 'asc' ? 'Ordem decrescente' : 'Ordem crescente', onClick: () => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc') },
    {
      label: isDefaultPath ? 'Esta já é a pasta padrão' : 'Definir como pasta padrão',
      onClick: () => setAsDefaultPath(),
      disabled: isDefaultPath,
    },
  ];

  function viewBtnStyle(active: boolean): CSSProperties {
    return {
      border: 'none',
      cursor: 'pointer',
      padding: 6,
      borderRadius: 6,
      display: 'flex',
      alignItems: 'center',
      background: active ? '#e8f0fe' : 'transparent',
      color: active ? '#1a73e8' : '#333',
    };
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid #e0e0e0' }}>
      <Tooltip content="Voltar" side="bottom">
        <button onClick={goBack} disabled={!canGoBack} style={iconBtnStyle(canGoBack)}>
          <MdArrowBack size={18} />
        </button>
      </Tooltip>
      <Tooltip content="Avançar" side="bottom">
        <button onClick={goForward} disabled={!canGoForward} style={iconBtnStyle(canGoForward)}>
          <MdArrowForward size={18} />
        </button>
      </Tooltip>
      <Tooltip content="Pasta pai" side="bottom">
        <button onClick={goUp} disabled={!canGoUp} style={iconBtnStyle(canGoUp)}>
          <MdArrowUpward size={18} />
        </button>
      </Tooltip>
      <Tooltip content="Atualizar" side="bottom">
        <button onClick={refresh} style={iconBtnStyle(true)}>
          <MdRefresh size={18} />
        </button>
      </Tooltip>

      <input
        type="range"
        min={24}
        max={96}
        step={4}
        value={previewSize}
        onChange={(e) => setPreviewSize(Number(e.target.value))}
        title="Tamanho do preview"
        style={{ width: 80, cursor: 'pointer' }}
      />

      <button onClick={(e) => setMenuAnchor({ x: e.clientX, y: e.clientY })} style={iconBtnStyle(true)}>
        <MdMoreVert size={18} />
      </button>

      <Tooltip content="Atualizar" side="bottom">
        <button onClick={refresh} style={iconBtnStyle(true)}>
          <MdRefresh size={18} />
        </button>
      </Tooltip>

      <div style={{ display: 'flex', gap: 2, marginLeft: 4, borderLeft: '1px solid #e0e0e0', paddingLeft: 6 }}>
        <Tooltip content="Ícones" side="bottom">
          <button onClick={() => setViewMode('icons')} style={viewBtnStyle(viewMode === 'icons')}>
            <MdGridView size={16} />
          </button>
        </Tooltip>
        <Tooltip content="Lista" side="bottom">
          <button onClick={() => setViewMode('list')} style={viewBtnStyle(viewMode === 'list')}>
            <MdViewList size={16} />
          </button>
        </Tooltip>
        <Tooltip content="Colunas" side="bottom">
          <button onClick={() => setViewMode('columns')} style={viewBtnStyle(viewMode === 'columns')}>
            <MdViewColumn size={16} />
          </button>
        </Tooltip>
      </div>

      {menuAnchor && (
        <ContextMenu
          x={menuAnchor.x}
          y={menuAnchor.y}
          items={menuItems}
          onClose={() => setMenuAnchor(null)}
        />
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: '#f2f2f2', borderRadius: 6, padding: '6px 10px', marginLeft: 8 }}>
        <MdSearch size={16} color="#999" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar nesta pasta"
          style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, flex: 1 }}
        />
      </div>

    </div>
  );
}

function iconBtnStyle(enabled: boolean): CSSProperties {
  return {
    border: 'none',
    background: 'none',
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.35,
    padding: 6,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    color: '#333',
  };
}
