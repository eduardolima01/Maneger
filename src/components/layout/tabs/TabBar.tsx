import { useRef, useState } from 'react';
import {
  useTabs, activateTab, closeTab, moveTab, tabDisplayTitle, tabDisplayIcon, tabDisplayIconUrl,
  setCustomTitle, clearCustomTitle, toggleTabFavorite, isPathFavorite,
} from './tabStore';
import NewTabMenu from './NewTabMenu';
import TabNavControls from './TabNavControls';

const DRAG_THRESHOLD_PX = 5;

export default function TabBar() {
  const { tabs, activeTabId } = useTabs();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const overIdRef = useRef<string | null>(null);
  const suppressClickRef = useRef(false);

  function startRename(id: string, currentTitle: string) {
    setEditingId(id);
    setEditingValue(currentTitle);
  }

  function commitRename() {
    if (editingId) setCustomTitle(editingId, editingValue);
    setEditingId(null);
  }

  // Reordenação por pointer events (não depende do drag and drop nativo do HTML,
  // que fica bloqueado quando o Tauri está com dragDropEnabled: true)
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, id: string) {
    if (e.button !== 0 || editingId === id) return;
    if ((e.target as HTMLElement).closest('button, input')) return;

    const startX = e.clientX;
    let active = false;

    const onMove = (ev: PointerEvent) => {
      if (!active) {
        if (Math.abs(ev.clientX - startX) < DRAG_THRESHOLD_PX) return;
        active = true;
        setDragId(id);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
      }

      let found: string | null = null;
      for (const [tabId, el] of Object.entries(tabRefs.current)) {
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (ev.clientX >= rect.left && ev.clientX <= rect.right) {
          found = tabId;
          break;
        }
      }
      overIdRef.current = found;
      setOverId(found);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      if (active) {
        // evita que o clique que encerra o arrastar também ative a aba
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, 0);

        const target = overIdRef.current;
        if (target && target !== id) moveTab(id, target);
      }

      overIdRef.current = null;
      setDragId(null);
      setOverId(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  const dragIndex = tabs.findIndex((t) => t.id === dragId);

  return (
    <div className="flex items-center border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <button
        onClick={() => activateTab(null)}
        className={[
          'px-4 py-2 border-none cursor-pointer font-medium',
          'text-zinc-700 dark:text-zinc-300',
          activeTabId === null
            ? 'bg-white dark:bg-zinc-900 border-b-2 border-zinc-800 dark:border-zinc-200'
            : 'bg-transparent border-b-2 border-transparent',
        ].join(' ')}
      >
        Início
      </button>

      <TabNavControls />

      {tabs.map((tab, index) => {
        const path = tab.router.state.location.pathname;
        const favorite = isPathFavorite(path);

        // indicador de destino: esquerda se arrastando pra esquerda, direita se pra direita
        const isDropTarget = dragId !== null && overId === tab.id && dragId !== tab.id;
        const dropSide = dragIndex < index ? 'right' : 'left';

        return (
          <div
            key={tab.id}
            ref={(el) => { tabRefs.current[tab.id] = el; }}
            onPointerDown={(e) => handlePointerDown(e, tab.id)}
            onClick={() => {
              if (suppressClickRef.current) return;
              activateTab(tab.id);
            }}
            onDoubleClick={() => startRename(tab.id, tabDisplayTitle(tab))}
            className={[
              'flex items-center gap-1.5 px-3 py-2 cursor-pointer border-x-2 select-none',
              'text-zinc-700 dark:text-zinc-300',
              activeTabId === tab.id
                ? 'bg-white dark:bg-zinc-900 border-b-2 border-b-zinc-800 dark:border-b-zinc-200'
                : 'bg-transparent border-b-2 border-b-transparent',
              dragId === tab.id ? 'opacity-40' : '',
              isDropTarget && dropSide === 'left' ? 'border-l-blue-500' : 'border-l-transparent',
              isDropTarget && dropSide === 'right' ? 'border-r-blue-500' : 'border-r-transparent',
            ].join(' ')}
          >
            {editingId === tab.id ? (
              <input
                autoFocus
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-sm px-1 py-0.5 w-[120px] bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-600 rounded select-text"
              />
            ) : (
              <span className="flex items-center gap-1.5">
                {tabDisplayIconUrl(tab) ? (
                  <img
                    src={tabDisplayIconUrl(tab)}
                    alt=""
                    draggable={false}
                    className="w-4 h-4 rounded-sm object-cover shrink-0"
                  />
                ) : (
                  <span>{tabDisplayIcon(tab)}</span>
                )}
                {tabDisplayTitle(tab)}
              </span>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); toggleTabFavorite(tab.id); }}
              aria-label={favorite ? `Remover ${tabDisplayTitle(tab)} dos favoritos` : `Favoritar ${tabDisplayTitle(tab)}`}
              title={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              className={[
                'border-none bg-transparent cursor-pointer text-xs',
                favorite
                  ? 'text-amber-500 dark:text-amber-400'
                  : 'text-zinc-300 dark:text-zinc-600 hover:text-amber-400 dark:hover:text-amber-500',
              ].join(' ')}
            >
              {favorite ? '★' : '☆'}
            </button>

            {tab.customTitle && editingId !== tab.id && (
              <button
                onClick={(e) => { e.stopPropagation(); clearCustomTitle(tab.id); }}
                aria-label={`Restaurar nome padrão da aba ${tabDisplayTitle(tab)}`}
                title="Restaurar nome padrão"
                className="border-none bg-transparent cursor-pointer text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs"
              >
                ↺
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              aria-label={`Fechar aba ${tabDisplayTitle(tab)}`}
              className="border-none bg-transparent cursor-pointer text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
        );
      })}

      <NewTabMenu />
    </div>
  );
}
