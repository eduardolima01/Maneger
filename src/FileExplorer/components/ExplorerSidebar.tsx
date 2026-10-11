import { MdHome, MdFolder, MdDownload, MdDesktopWindows, MdDelete, MdAdd, MdEdit, MdClose, MdExpandMore, MdChevronRight } from 'react-icons/md';
import type { QuickAccessLocation } from '../types/fileExplorer.types';
import type { FolderGroup } from '../utils/folderGroups';
import { samePathLoose } from '../utils/folderGroups';
import { basename } from '../utils/actionHistory';

const ICON_BY_LABEL: Record<string, typeof MdHome> = {
  'Início': MdHome,
  'Documentos': MdFolder,
  'Downloads': MdDownload,
  'Área de trabalho': MdDesktopWindows,
};

interface ExplorerSidebarProps {
  locations: QuickAccessLocation[];
  currentPath: string | null;
  onNavigate: (path: string) => void;
  onOpenTrash: () => void;
  viewingTrash: boolean;
  /** Grupos de pastas salvos pelo usuário (atalhos pelo caminho absoluto). */
  groups: FolderGroup[];
  onCreateGroup: () => void;
  onRenameGroup: (group: FolderGroup) => void;
  onDeleteGroup: (group: FolderGroup) => void;
  onToggleGroup: (id: string) => void;
  onRemoveFromGroup: (groupId: string, path: string) => void;
}

/**
 * Hoje só mostra "Locais" (atalhos fixos vindos do backend: Início/Documentos/
 * Downloads/Área de trabalho). Estrutura preparada pra uma seção "Favoritos"
 * separada e editável pelo usuário no futuro — só precisaria de uma segunda
 * lista (favoritos custom, persistida em prefs) renderizada acima desta.
 */
const ITEM_BASE = 'flex w-full cursor-pointer items-center gap-2 rounded-md border-none px-2 py-1.5 text-left text-[13px]';
const ITEM_ACTIVE = 'bg-blue-100 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300';
const ACTION_BTN = 'flex shrink-0 cursor-pointer rounded border-none bg-transparent p-0.5 text-zinc-400 opacity-0 hover:text-zinc-700 group-hover:opacity-100 dark:hover:text-zinc-200';
const ITEM_IDLE = 'bg-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800';

export default function ExplorerSidebar({
  locations, currentPath, onNavigate, onOpenTrash, viewingTrash,
  groups, onCreateGroup, onRenameGroup, onDeleteGroup, onToggleGroup, onRemoveFromGroup,
}: ExplorerSidebarProps) {
  return (
    <div className="w-[180px] overflow-y-auto border-r border-zinc-200 px-2 py-3 dark:border-zinc-700">
      <p className="mx-2 mb-1.5 mt-1 text-[11px] uppercase text-zinc-400">Locais</p>
      {locations.map((loc) => {
        const Icon = ICON_BY_LABEL[loc.label] ?? MdFolder;
        const active = loc.path === currentPath;
        return (
          <button
            key={loc.path}
            onClick={() => onNavigate(loc.path)}
            // alvo de soltar: arrastar itens selecionados até aqui move pra essa pasta
            data-drop-path={loc.path}
            className={`${ITEM_BASE} mb-0.5 ${active ? ITEM_ACTIVE : ITEM_IDLE}`}
          >
            <Icon size={16} />
            {loc.label}
          </button>
        );
      })}

      <div className="mx-2 mb-1.5 mt-4 flex items-center justify-between">
        <p className="m-0 text-[11px] uppercase text-zinc-400">Grupos</p>
        <button
          title="Novo grupo"
          onClick={onCreateGroup}
          className="flex cursor-pointer rounded border-none bg-transparent p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <MdAdd size={16} />
        </button>
      </div>
      {groups.length === 0 && (
        <p className="mx-2 mb-1 text-[11px] text-zinc-400">Crie um grupo e arraste pastas pra ele.</p>
      )}
      {groups.map((group) => (
        // alvo de soltar: arrastar pastas até aqui adiciona o atalho delas ao grupo
        <div key={group.id} data-drop-group={group.id} className="mb-1 rounded-md">
          <div className="group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <button
              onClick={() => onToggleGroup(group.id)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left text-[13px] font-medium text-zinc-700 dark:text-zinc-200"
            >
              {group.collapsed ? <MdChevronRight size={16} className="shrink-0" /> : <MdExpandMore size={16} className="shrink-0" />}
              <span className="truncate">{group.name}</span>
              <span className="text-[11px] font-normal text-zinc-400">{group.paths.length}</span>
            </button>
            <button title="Renomear grupo" onClick={() => onRenameGroup(group)} className={ACTION_BTN}>
              <MdEdit size={14} />
            </button>
            <button title="Excluir grupo (as pastas não são apagadas)" onClick={() => onDeleteGroup(group)} className={ACTION_BTN}>
              <MdDelete size={14} />
            </button>
          </div>
          {!group.collapsed && (group.paths.length === 0 ? (
            <p className="px-6 py-1 text-[11px] text-zinc-400">Arraste pastas pra cá</p>
          ) : (
            group.paths.map((path) => {
              const active = !!currentPath && samePathLoose(path, currentPath);
              return (
                <div key={path} className="group flex items-center gap-1">
                  <button
                    onClick={() => onNavigate(path)}
                    // soltar arquivos aqui move pra essa pasta
                    data-drop-path={path}
                    title={path}
                    className={`${ITEM_BASE} ml-3 min-w-0 flex-1 ${active ? ITEM_ACTIVE : ITEM_IDLE}`}
                  >
                    <MdFolder size={16} className="shrink-0" />
                    <span className="truncate">{basename(path)}</span>
                  </button>
                  <button title="Remover do grupo" onClick={() => onRemoveFromGroup(group.id, path)} className={ACTION_BTN}>
                    <MdClose size={14} />
                  </button>
                </div>
              );
            })
          ))}
        </div>
      ))}

      <p className="mx-2 mb-1.5 mt-4 text-[11px] uppercase text-zinc-400">Lixeira</p>
      <button
        onClick={onOpenTrash}
        // alvo de soltar: arrastar itens selecionados até aqui manda pra lixeira (sem confirmação)
        data-drop-zone="trash"
        className={`${ITEM_BASE} ${viewingTrash ? ITEM_ACTIVE : ITEM_IDLE}`}
      >
        <MdDelete size={16} />
        Lixeira
      </button>
    </div>
  );
}
