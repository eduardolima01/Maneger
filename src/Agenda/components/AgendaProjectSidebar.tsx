import { useEffect, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useProjects } from '@/lib/hooks/useProjects';
import { useFavoriteProjects } from '@/lib/hooks/useFavoriteProjects';
import { getEventCountsByProject } from '@/lib/api/events';
import type { ProjectType } from '@/types/project.types';

const MAX_PROJECTS = 8;
const THUMB_SIZE = 40;

// Chaves customizadas de dataTransfer pra distinguir "arrastar um projeto da
// barra lateral" de "arrastar um evento existente" (que já usa 'text/plain'
// com o id do evento, no MonthView) — evita os dois tipos de drag se
// confundirem no mesmo onDrop.
export const PROJECT_DRAG_ID_KEY = 'application/x-agenda-project-id';
export const PROJECT_DRAG_NAME_KEY = 'application/x-agenda-project-name';

interface HoverInfo {
  id: string;
  name: string;
  count: number;
  rect: DOMRect;
}

/**
 * Cores de interface (fundo, texto, borda) usam classes Tailwind `dark:`,
 * que acompanham a classe `dark` da <html> de verdade — diferente da
 * primeira versão, que fixava cores claras direto e só "não ficava
 * invisível", sem realmente seguir o tema. As cores por projeto (capa,
 * cor do projeto) continuam inline, porque são dados, não tema.
 */
export default function AgendaProjectSidebar() {
  const { projects } = useProjects();
  const { isFavorite } = useFavoriteProjects();
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [hover, setHover] = useState<HoverInfo | null>(null);

  useEffect(() => {
    getEventCountsByProject().then(setEventCounts);
  }, []);

  function byFavoriteThenUsage(a: ProjectType, b: ProjectType) {
    const favDiff = (isFavorite(b.id) ? 1 : 0) - (isFavorite(a.id) ? 1 : 0);
    if (favDiff !== 0) return favDiff;
    const diff = (eventCounts[b.id] ?? 0) - (eventCounts[a.id] ?? 0);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  }

  const isSearching = query.trim().length > 0;

  const topProjects = projects
    .filter((p) => (eventCounts[p.id] ?? 0) > 0)
    .sort(byFavoriteThenUsage)
    .slice(0, MAX_PROJECTS);

  const searchResults = projects
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort(byFavoriteThenUsage);

  const listToShow = isSearching ? searchResults : topProjects;

  function handleDragStart(e: React.DragEvent, p: ProjectType) {
    e.dataTransfer.setData(PROJECT_DRAG_ID_KEY, p.id);
    e.dataTransfer.setData(PROJECT_DRAG_NAME_KEY, p.name);
    e.dataTransfer.effectAllowed = 'copy';
  }

  function showHover(e: React.MouseEvent, p: ProjectType) {
    setHover({ id: p.id, name: p.name, count: eventCounts[p.id] ?? 0, rect: e.currentTarget.getBoundingClientRect() });
  }

  function hideHover(id: string) {
    setHover((h) => (h?.id === id ? null : h));
  }

  return (
    <div className="w-24 flex-shrink-0 overflow-y-auto border-r border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-2.5">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar…"
        className="mb-2.5 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1.5 py-1 text-[11px] text-gray-800 dark:text-gray-100 outline-none placeholder-gray-400 dark:placeholder-gray-500"
      />

      {!isSearching && (
        <div className="mb-2 text-center text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">
          Projetos
        </div>
      )}

      {listToShow.length === 0 ? (
        <div className="text-center text-[11px] text-gray-500 dark:text-gray-400">
          {isSearching ? 'Nenhum projeto encontrado.' : 'Sem histórico ainda.'}
        </div>
      ) : isSearching ? (
        // Modo busca: lista com nome sempre visível (não faz sentido exigir
        // hover pra achar um projeto que você está procurando pelo nome).
        listToShow.map((p) => (
          <div
            key={p.id}
            draggable
            onDragStart={(e) => handleDragStart(e, p)}
            title="Arraste pra um horário da agenda"
            className="mb-1 flex cursor-grab items-center gap-1.5 rounded px-1 py-1.5"
          >
            <ProjectThumb project={p} size={22} />
            <span className="flex-1 truncate text-[11px] text-gray-800 dark:text-gray-100">
              {isFavorite(p.id) && '★ '}{p.name}
            </span>
          </div>
        ))
      ) : (
        listToShow.map((p) => (
          <div
            key={p.id}
            draggable
            onDragStart={(e) => handleDragStart(e, p)}
            onMouseEnter={(e) => showHover(e, p)}
            onMouseLeave={() => hideHover(p.id)}
            className="relative mb-2.5 flex cursor-grab justify-center"
          >
            <ProjectThumb project={p} size={THUMB_SIZE} favorite={isFavorite(p.id)} />
          </div>
        ))
      )}

      {hover && (
        <div
          className="fixed z-[1000] whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white pointer-events-none"
          style={{ top: hover.rect.top + hover.rect.height / 2, left: hover.rect.right + 8, transform: 'translateY(-50%)' }}
        >
          {hover.name}
          {hover.count > 0 && <span className="ml-1.5 opacity-70">· {hover.count}</span>}
        </div>
      )}
    </div>
  );
}

function ProjectThumb({ project, size, favorite }: { project: ProjectType; size: number; favorite?: boolean }) {
  const borderColor = project.color ?? '#ccc';
  return (
    <div style={{ position: 'relative' }}>
      {project.cover_path ? (
        <img
          src={convertFileSrc(project.cover_path)}
          draggable={false}
          style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', border: `2px solid ${borderColor}` }}
        />
      ) : (
        <div
          style={{
            width: size, height: size, borderRadius: 8, backgroundColor: borderColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: Math.max(10, size * 0.4), fontWeight: 700,
          }}
        >
          {project.name.charAt(0).toUpperCase()}
        </div>
      )}
      {favorite && (
        <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 11, color: '#f6bf26', textShadow: '0 0 2px rgba(0,0,0,0.6)' }}>
          ★
        </span>
      )}
    </div>
  );
}
