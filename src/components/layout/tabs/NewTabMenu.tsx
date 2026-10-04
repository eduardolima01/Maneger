import { useEffect, useMemo, useRef, useState } from 'react';
import {
  openEntityTab,
  openNewTab,
  useFavoritePages,
  useMostVisitedPages,
  pageVisitTitle,
  pageVisitIcon,
  pageVisitIconUrl,
} from './tabStore';
import { useAllProjects } from './useAllProjects';

type MenuItem = {
  key: string;
  section: 'Atalhos' | 'Favoritos' | 'Projetos' | 'Mais acessadas';
  title: string;
  icon?: string;
  iconUrl?: string;
  count?: number;
  action: () => void;
};

const SECTION_ORDER: MenuItem['section'][] = ['Atalhos', 'Favoritos', 'Projetos', 'Mais acessadas'];

export default function NewTabMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const favorites = useFavoritePages();
  const mostVisited = useMostVisitedPages(6);
  const projects = useAllProjects(open);

  function close() {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }

  function goTo(path: string) {
    openEntityTab(path);
    close();
  }

  function blankTab() {
    openNewTab('/');
    close();
  }

  // Atalho global: Ctrl+T / Cmd+T abre e fecha o menu
  useEffect(() => {
    function onShortcut(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery('');
        setActiveIndex(0);
      }
    }
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  // Fechar ao clicar fora / Esc enquanto aberto
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  // Foco no campo de busca ao abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Monta a lista única (sem repetir páginas) e aplica o filtro
  const items = useMemo<MenuItem[]>(() => {
    const seen = new Set<string>();
    const all: MenuItem[] = [];

    all.push({
      key: 'blank',
      section: 'Atalhos',
      title: 'Aba em branco',
      icon: '🗂️',
      action: blankTab,
    });

    for (const fav of favorites) {
      if (seen.has(fav.path)) continue;
      seen.add(fav.path);
      all.push({
        key: `fav:${fav.path}`,
        section: 'Favoritos',
        title: fav.title,
        icon: fav.icon ?? '⭐',
        iconUrl: fav.iconUrl,
        action: () => goTo(fav.path),
      });
    }

    for (const p of projects) {
      if (seen.has(p.path)) continue;
      seen.add(p.path);
      all.push({
        key: `proj:${p.path}`,
        section: 'Projetos',
        title: p.title,
        icon: '📁',
        iconUrl: p.iconUrl,
        action: () => goTo(p.path),
      });
    }

    for (const entry of mostVisited) {
      if (seen.has(entry.path)) continue;
      seen.add(entry.path);
      all.push({
        key: `visit:${entry.path}`,
        section: 'Mais acessadas',
        title: pageVisitTitle(entry),
        icon: pageVisitIcon(entry),
        iconUrl: pageVisitIconUrl(entry),
        count: entry.count,
        action: () => goTo(entry.path),
      });
    }

    const q = query.trim().toLowerCase();
    return q ? all.filter((i) => i.title.toLowerCase().includes(q)) : all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites, projects, mostVisited, query]);

  // Mantém o item ativo dentro do intervalo
  useEffect(() => {
    if (activeIndex > items.length - 1) setActiveIndex(Math.max(items.length - 1, 0));
  }, [items.length, activeIndex]);

  // Rola até o item ativo
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[activeIndex]?.action();
    }
  }

  // Agrupa por seção mantendo o índice global de cada item
  const grouped = SECTION_ORDER.map((section) => ({
    section,
    entries: items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.section === section),
  })).filter((g) => g.entries.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => (open ? close() : setOpen(true))}
        aria-label="Nova aba (Ctrl+T)"
        title="Nova aba (Ctrl+T)"
        aria-expanded={open}
        className="border-none bg-transparent cursor-pointer px-3 py-2 text-base text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        +
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Buscar projeto ou página..."
            className="w-full rounded-t-lg border-b border-zinc-100 bg-transparent px-3 py-2 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 dark:border-zinc-800 dark:text-zinc-100"
          />

          <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
            {grouped.map(({ section, entries }) => (
              <div key={section}>
                {section !== 'Atalhos' && (
                  <div className="px-3 pt-2 pb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    {section}
                  </div>
                )}
                {entries.map(({ item, index }) => (
                  <button
                    key={item.key}
                    data-index={index}
                    onClick={item.action}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 ${index === activeIndex
                        ? 'bg-zinc-100 dark:bg-zinc-800'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                  >
                    {item.iconUrl ? (
                      <img
                        src={item.iconUrl}
                        alt=""
                        className="w-4 h-4 rounded-sm object-cover shrink-0"
                      />
                    ) : (
                      <span>{item.icon}</span>
                    )}
                    <span className="truncate flex-1">{item.title}</span>
                    {item.count !== undefined && (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">{item.count}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}

            {items.length === 0 && (
              <div className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-500">
                Nada encontrado.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
