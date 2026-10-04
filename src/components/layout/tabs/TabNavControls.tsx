import { useEffect, useRef, useState } from 'react';
import {
  useTabs,
  useTabNavState,
  useTabNavHistory,
  goBackInTab,
  goForwardInTab,
  goToTabHistoryIndex,
  findPageVisit,
  pageVisitTitle,
  pageVisitIcon,
  pageVisitIconUrl,
} from './tabStore';

export default function TabNavControls() {
  const { activeTabId } = useTabs();
  const { canGoBack, canGoForward } = useTabNavState(activeTabId);
  const history = useTabNavHistory(activeTabId);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // fecha o dropdown se a aba ativa mudar ou não houver nenhuma aba real aberta
  useEffect(() => {
    setOpen(false);
  }, [activeTabId]);

  if (!activeTabId) return null; // aba "Início" não tem histórico próprio rastreado

  function labelFor(path: string) {
    const visit = findPageVisit(path);
    return visit ? pageVisitTitle(visit) : path;
  }
  function iconFor(path: string) {
    const visit = findPageVisit(path);
    return visit ? { emoji: pageVisitIcon(visit), url: pageVisitIconUrl(visit) } : { emoji: '🗂️', url: undefined };
  }

  return (
    <div className="flex items-center gap-0.5 px-1" ref={containerRef}>
      <button
        onClick={() => activeTabId && goBackInTab(activeTabId)}
        disabled={!canGoBack}
        title="Voltar"
        aria-label="Voltar"
        className="border-none bg-transparent px-1.5 py-1 rounded text-zinc-600 dark:text-zinc-400 disabled:opacity-30 disabled:cursor-default enabled:cursor-pointer enabled:hover:bg-zinc-200 enabled:dark:hover:bg-zinc-800"
      >
        ◀
      </button>
      <button
        onClick={() => activeTabId && goForwardInTab(activeTabId)}
        disabled={!canGoForward}
        title="Avançar"
        aria-label="Avançar"
        className="border-none bg-transparent px-1.5 py-1 rounded text-zinc-600 dark:text-zinc-400 disabled:opacity-30 disabled:cursor-default enabled:cursor-pointer enabled:hover:bg-zinc-200 enabled:dark:hover:bg-zinc-800"
      >
        ▶
      </button>

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={history.length <= 1}
          title="Histórico de navegação desta aba"
          aria-label="Histórico de navegação desta aba"
          aria-expanded={open}
          className="border-none bg-transparent px-1.5 py-1 rounded text-zinc-600 dark:text-zinc-400 disabled:opacity-30 disabled:cursor-default enabled:cursor-pointer enabled:hover:bg-zinc-200 enabled:dark:hover:bg-zinc-800"
        >
          🕘
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-72 max-h-80 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <div className="px-3 pt-2 pb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
              Histórico desta aba
            </div>
            {[...history].reverse().map((entry) => {
              const icon = iconFor(entry.path);
              return (
                <button
                  key={entry.index}
                  onClick={() => { goToTabHistoryIndex(activeTabId, entry.index); setOpen(false); }}
                  className={[
                    'w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm',
                    entry.isCurrent
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                  ].join(' ')}
                >
                  {icon.url ? (
                    <img src={icon.url} alt="" className="w-4 h-4 rounded-sm object-cover shrink-0" />
                  ) : (
                    <span>{icon.emoji}</span>
                  )}
                  <span className="truncate flex-1">{labelFor(entry.path)}</span>
                  {entry.isCurrent && <span className="text-xs text-zinc-400 dark:text-zinc-500">atual</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
