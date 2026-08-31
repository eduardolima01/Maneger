import { useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { createProject } from '@/lib/api/projects';
import { useProjects } from '@/lib/hooks/useProjects';
import { useFavoriteProjects } from '@/lib/hooks/useFavoriteProjects';
import { getEventCountsByProject } from '@/lib/api/events';
import type { ProjectType } from '@/types/project.types';
import { buildBreadcrumbLabel } from '@/Projects/utils/projectBreadcrumb';

interface AgendaProjectSelectProps {
  value: string | null;
  onChange: (projectId: string | null, project: ProjectType | null) => void;
}

function ProjectThumb({ path, size = 28 }: { path: string | null; size?: number }) {
  return path ? (
    <img
      src={convertFileSrc(path)}
      style={{ width: size, height: size, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
    />
  ) : (
    <div style={{ width: size, height: size, borderRadius: 4, backgroundColor: '#eee', flexShrink: 0 }} />
  );
}

export default function AgendaProjectSelect({ value, onChange }: AgendaProjectSelectProps) {
  const { projects, refresh } = useProjects();
  const { isFavorite, toggleFavorite } = useFavoriteProjects();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getEventCountsByProject().then(setEventCounts);
  }, []);

  const selectedProject = projects.find((p) => p.id === value) ?? null;
  const selectedBreadcrumb = selectedProject ? buildBreadcrumbLabel(projects, selectedProject.id) : '';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function byUsageThenName(a: ProjectType, b: ProjectType) {
    const diff = (eventCounts[b.id] ?? 0) - (eventCounts[a.id] ?? 0);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  }

  const filtered = projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const exactMatch = projects.some((p) => p.name.toLowerCase() === query.trim().toLowerCase());
  const favorites = filtered.filter((p) => isFavorite(p.id)).sort(byUsageThenName);
  const nonFavorites = filtered.filter((p) => !isFavorite(p.id)).sort(byUsageThenName);

  function selectProject(project: ProjectType) {
    onChange(project.id, project);
    setIsOpen(false);
    setQuery('');
  }

  function renderRow(p: ProjectType) {
    const favorited = isFavorite(p.id);
    const breadcrumb = buildBreadcrumbLabel(projects, p.id);
    const parentLabel = breadcrumb.includes(' / ') ? breadcrumb.slice(0, breadcrumb.lastIndexOf(' / ')) : null;
    const count = eventCounts[p.id] ?? 0;
    return (
      <div
        key={p.id}
        style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', padding: '8px 8px 8px 8px' }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <span onClick={() => selectProject(p)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer', minWidth: 0 }}>
          <ProjectThumb path={p.cover_path} />
          <span style={{ minWidth: 0 }}>
            <span style={{ fontSize: 14, display: 'block' }}>{p.name}</span>
            {parentLabel && (
              <span style={{ fontSize: 11, color: '#999', display: 'block' }}>{parentLabel}</span>
            )}
          </span>
        </span>
        {count > 0 && (
          <span title={`${count} evento${count !== 1 ? 's' : ''} na Agenda`} style={{ fontSize: 11, color: '#999', flexShrink: 0 }}>
            {count}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }}
          title={favorited ? 'Remover dos favoritos' : 'Marcar como favorito'}
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: favorited ? '#f6bf26' : '#ccc', padding: '0 4px' }}
        >
          {favorited ? '★' : '☆'}
        </button>
      </div>
    );
  }

  function clearSelection() {
    onChange(null, null);
    setQuery('');
  }

  async function handleCreate() {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const id = await createProject({ name });
      await refresh();
      onChange(id, { id, name, color: null, cover_path: null, archived: 0 });
      setIsOpen(false);
      setQuery('');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {selectedProject && !isOpen ? (
        <div
          onClick={() => setIsOpen(true)}
          style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', padding: 8, border: '1px solid #ccc', borderRadius: 4, fontSize: 14, cursor: 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <ProjectThumb path={selectedProject.cover_path} size={24} />
            <span title={selectedBreadcrumb} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedBreadcrumb}
            </span>
          </span>
          <button onClick={(e) => { e.stopPropagation(); clearSelection(); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#666' }}>
            ✕
          </button>
        </div>
      ) : (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar ou criar projeto..."
          style={{ width: '100%', padding: 8, fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}
        />
      )}

      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, border: '1px solid #ccc', borderRadius: 4, backgroundColor: '#fff', maxHeight: 240, overflowY: 'auto', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div onClick={clearSelection} style={{ padding: 8, fontSize: 13, color: '#666', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
            Sem projeto
          </div>

          {favorites.length > 0 && (
            <>
              <div style={{ padding: '6px 8px 2px', fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>★ Favoritos</div>
              {favorites.map(renderRow)}
              {nonFavorites.length > 0 && (
                <div style={{ padding: '6px 8px 2px', fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', borderTop: '1px solid #eee' }}>
                  Todos os projetos
                </div>
              )}
            </>
          )}

          {nonFavorites.map(renderRow)}

          {query.trim() && !exactMatch && (
            <div onClick={handleCreate} style={{ padding: 8, fontSize: 14, cursor: creating ? 'default' : 'pointer', color: '#1a73e8', borderTop: filtered.length > 0 ? '1px solid #eee' : undefined, opacity: creating ? 0.6 : 1 }}>
              {creating ? 'Criando...' : `+ Criar projeto "${query.trim()}"`}
            </div>
          )}

          {filtered.length === 0 && !query.trim() && (
            <div style={{ padding: 8, fontSize: 13, color: '#999' }}>Nenhum projeto ainda</div>
          )}
        </div>
      )}
    </div>
  );
}
