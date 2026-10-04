import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { convertFileSrc } from '@tauri-apps/api/core';
import { createProject } from '@/lib/api/projects';
import { useProjects } from '@/lib/hooks/useProjects';
import { useFavoriteProjects } from '@/lib/hooks/useFavoriteProjects';
import { useProjectCovers } from '@/lib/hooks/project/useProjectCovers';
import { useProjectColors } from '@/lib/hooks/useProjectColors';
import type { ProjectType } from '@/types/project.types';
import { buildBreadcrumbLabel } from '@/Projects/utils/projectBreadcrumb';

interface QuickCreateEventMenuProps {
  open: boolean;
  /** Ponto da tela onde o menu abre (onde o usuário clicou). */
  position: { x: number; y: number } | null;
  /** Horário padrão do evento (só exibido; quem cria é o `onCreate` do pai). */
  start: Date | null;
  end: Date | null;
  onClose: () => void;
  onCreate: (data: { title: string; project_id: string | null }) => Promise<void> | void;
  /** Shift+Enter ou botão: abre o modal completo (horário, capa etc.). */
  onOpenFullEditor: () => void;
}

type Row =
  | { kind: 'plain' }
  | { kind: 'project'; project: ProjectType; group: 'fav' | 'all' }
  | { kind: 'new' };

const MENU_W = 320;
const LIST_MAX_H = 240;

/** Miniatura do projeto: a capa, ou um quadrado na cor do projeto com a inicial se não houver capa. */
function Thumb({ src, color, label }: { src: string | null; color: string; label: string }) {
  const [failed, setFailed] = useState(false);
  const base = { width: 28, height: 28, borderRadius: 6, flexShrink: 0 } as const;
  if (src && !failed) {
    return <img key={src} src={convertFileSrc(src)} alt="" onError={() => setFailed(true)} style={{ ...base, objectFit: 'cover' }} />;
  }
  return (
    <span
      style={{
        ...base, backgroundColor: color, color: '#fff', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
      }}
    >
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Menu de criação rápida de evento. Digite o nome do evento ou busque um projeto:
 * ↑/↓ navegam, Enter cria no horário padrão, Esc fecha.
 * - Sem projeto escolhido, Enter cria o evento com o texto digitado.
 * - Projeto escolhido: o evento leva o nome do projeto.
 * - "+ Criar projeto": cria o projeto (mesma API do seletor do modal) e o evento nele.
 */
export default function QuickCreateEventMenu({
  open, position, start, end, onClose, onCreate, onOpenFullEditor,
}: QuickCreateEventMenuProps) {
  const { projects, refresh } = useProjects();
  const { isFavorite, toggleFavorite } = useFavoriteProjects();
  const { resolveCover } = useProjectCovers();
  const { resolveColor } = useProjectColors();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const q = query.trim();
  const lower = q.toLowerCase();
  const filtered = projects.filter((p) => p.name.toLowerCase().includes(lower));
  const favorites = filtered.filter((p) => isFavorite(p.id));
  const others = filtered.filter((p) => !isFavorite(p.id));
  const exactMatch = projects.some((p) => p.name.toLowerCase() === lower);

  const rows: Row[] = [
    ...(q ? [{ kind: 'plain' } as Row] : []),
    ...favorites.map((project) => ({ kind: 'project', project, group: 'fav' }) as Row),
    ...others.map((project) => ({ kind: 'project', project, group: 'all' }) as Row),
    ...(q && !exactMatch ? [{ kind: 'new' } as Row] : []),
  ];
  const idx = Math.min(activeIndex, rows.length - 1);
  const firstFav = rows.findIndex((r) => r.kind === 'project' && r.group === 'fav');
  const firstOther = rows.findIndex((r) => r.kind === 'project' && r.group === 'all');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(-1);
    setBusy(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [idx, open]);

  if (!open || !position) return null;

  async function activate(row: Row | undefined) {
    if (!row || busy) return;
    setBusy(true);
    try {
      if (row.kind === 'plain') {
        await onCreate({ title: q, project_id: null });
      } else if (row.kind === 'project') {
        await onCreate({ title: row.project.name, project_id: row.project.id });
      } else {
        const id = await createProject({ name: q });
        await refresh();
        await onCreate({ title: q, project_id: id });
      }
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(Math.min(rows.length - 1, idx + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(Math.max(rows.length ? 0 : -1, idx - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) onOpenFullEditor();
      else void activate(rows[idx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }

  const left = Math.max(8, Math.min(position.x, window.innerWidth - MENU_W - 8));
  const below = window.innerHeight - position.y >= LIST_MAX_H + 150;
  const posStyle = below
    ? { top: position.y + 8 }
    : { bottom: Math.max(8, window.innerHeight - position.y + 8) };

  const timeLabel = start && end
    ? `${start.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${hm(start)}–${hm(end)}`
    : '';

  function renderRow(row: Row, i: number) {
    const active = i === idx;
    let body: React.ReactNode;
    if (row.kind === 'plain') {
      body = (
        <>
          <span className="bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300" style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📅</span>
          <span style={{ fontSize: 14 }}>
            Criar evento “{q}” <span className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11 }}>(sem projeto)</span>
          </span>
        </>
      );
    } else if (row.kind === 'new') {
      body = (
        <>
          <span className="bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300" style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>+</span>
          <span className="text-blue-600 dark:text-blue-400" style={{ fontSize: 14 }}>Criar projeto “{q}”</span>
        </>
      );
    } else {
      const label = buildBreadcrumbLabel(projects, row.project.id);
      const parent = label.includes(' / ') ? label.slice(0, label.lastIndexOf(' / ')) : null;
      const fav = isFavorite(row.project.id);
      body = (
        <>
          <Thumb
            src={resolveCover(row.project.id) ?? row.project.cover_path ?? null}
            color={resolveColor(row.project.id)}
            label={row.project.name}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, display: 'block' }}>{row.project.name}</span>
            {parent && (
              <span className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {parent}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleFavorite(row.project.id); }}
            title={fav ? 'Remover dos favoritos' : 'Marcar como favorito'}
            className={fav ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
          >
            {fav ? '★' : '☆'}
          </button>
        </>
      );
    }
    return (
      <div key={row.kind === 'project' ? row.project.id : row.kind}>
        {i === firstFav && (
          <div className="text-gray-500 dark:text-gray-400" style={{ padding: '6px 10px 2px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>★ Favoritos</div>
        )}
        {i === firstOther && favorites.length > 0 && (
          <div className="border-t border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400" style={{ padding: '6px 10px 2px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Todos os projetos</div>
        )}
        <div
          data-active={active}
          onMouseEnter={() => setActiveIndex(i)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void activate(row)}
          className={active ? 'bg-blue-50 dark:bg-blue-900/40' : ''}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
        >
          {body}
        </div>
      </div>
    );
  }

  return createPortal(
    <div
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      className="border border-gray-300 bg-white text-gray-900 shadow-2xl dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      style={{ position: 'fixed', left, width: MENU_W, borderRadius: 8, zIndex: 80, overflow: 'hidden', ...posStyle }}
    >
      <div style={{ padding: 8 }}>
        {timeLabel && (
          <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, marginBottom: 6 }}>Novo evento · {timeLabel}</div>
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIndex(e.target.value.trim() ? 0 : -1); }}
          onKeyDown={handleKeyDown}
          placeholder="Nome do evento ou buscar projeto..."
          className="border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          style={{ width: '100%', padding: 8, fontSize: 14, borderRadius: 4 }}
        />
      </div>

      <div ref={listRef} className="border-t border-gray-200 dark:border-gray-700" style={{ maxHeight: LIST_MAX_H, overflowY: 'auto' }}>
        {rows.map(renderRow)}
        {rows.length === 0 && (
          <div className="text-gray-500 dark:text-gray-400" style={{ padding: 10, fontSize: 13 }}>
            Nenhum projeto ainda. Digite um nome para criar o evento.
          </div>
        )}
      </div>

      <div
        className="border-t border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 10 }}
      >
        <span>↑↓ escolher · Enter criar · Esc fechar</span>
        <button
          type="button"
          onClick={onOpenFullEditor}
          title="Shift+Enter"
          className="text-blue-600 hover:underline dark:text-blue-400"
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, padding: 0 }}
        >
          Editor completo
        </button>
      </div>
    </div>,
    document.body,
  );
}
