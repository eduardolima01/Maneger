import { useState } from 'react';
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

  // Tema claro/escuro por classes Tailwind (`dark:` exige a classe `dark` num ancestral)
  function viewBtnClass(active: boolean): string {
    return `flex cursor-pointer items-center rounded-md border-none p-1.5 ${
      active
        ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300'
        : 'bg-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
    }`;
  }

  return (
    <div className="flex items-center gap-1.5 border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
      <Tooltip content="Voltar" side="bottom">
        <button onClick={goBack} disabled={!canGoBack} className={iconBtnClass(canGoBack)}>
          <MdArrowBack size={18} />
        </button>
      </Tooltip>
      <Tooltip content="Avançar" side="bottom">
        <button onClick={goForward} disabled={!canGoForward} className={iconBtnClass(canGoForward)}>
          <MdArrowForward size={18} />
        </button>
      </Tooltip>
      <Tooltip content="Pasta pai" side="bottom">
        <button onClick={goUp} disabled={!canGoUp} className={iconBtnClass(canGoUp)}>
          <MdArrowUpward size={18} />
        </button>
      </Tooltip>
      <Tooltip content="Atualizar" side="bottom">
        <button onClick={refresh} className={iconBtnClass(true)}>
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
        className="w-20 cursor-pointer accent-blue-600 dark:accent-blue-400"
      />

      <button onClick={(e) => setMenuAnchor({ x: e.clientX, y: e.clientY })} className={iconBtnClass(true)}>
        <MdMoreVert size={18} />
      </button>

      <Tooltip content="Atualizar" side="bottom">
        <button onClick={refresh} className={iconBtnClass(true)}>
          <MdRefresh size={18} />
        </button>
      </Tooltip>

      <div className="ml-1 flex gap-0.5 border-l border-zinc-200 pl-1.5 dark:border-zinc-700">
        <Tooltip content="Ícones" side="bottom">
          <button onClick={() => setViewMode('icons')} className={viewBtnClass(viewMode === 'icons')}>
            <MdGridView size={16} />
          </button>
        </Tooltip>
        <Tooltip content="Lista" side="bottom">
          <button onClick={() => setViewMode('list')} className={viewBtnClass(viewMode === 'list')}>
            <MdViewList size={16} />
          </button>
        </Tooltip>
        <Tooltip content="Colunas" side="bottom">
          <button onClick={() => setViewMode('columns')} className={viewBtnClass(viewMode === 'columns')}>
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
      <div className="ml-2 flex flex-1 items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1.5 dark:bg-zinc-800">
        <MdSearch size={16} className="text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar nesta pasta"
          className="flex-1 border-none bg-transparent text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
        />
      </div>

    </div>
  );
}

function iconBtnClass(enabled: boolean): string {
  return `flex items-center rounded-md border-none bg-transparent p-1.5 text-zinc-700 dark:text-zinc-200 ${
    enabled ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800' : 'cursor-default opacity-[0.35]'
  }`;
}