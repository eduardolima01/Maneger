import { useEffect, useRef, useState } from 'react';
import { createProject } from '@/lib/api/projects';
import { useProjects } from '@/lib/hooks/useProjects';
import { useFavoriteProjects } from '@/lib/hooks/useFavoriteProjects';
import type { ProjectType } from '@/types/project.types';
import { buildBreadcrumbLabel } from '../utils/projectBreadcrumb';

interface ProjectSearchSelectProps {
  value: string | null;
  onChange: (projectId: string | null, project: ProjectType | null) => void;
}

export default function ProjectSearchSelect({ value, onChange }: ProjectSearchSelectProps) {
  const { projects, refresh } = useProjects();
  const { isFavorite, toggleFavorite } = useFavoriteProjects();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  const filtered = projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const exactMatch = projects.some((p) => p.name.toLowerCase() === query.trim().toLowerCase());
  const favorites = filtered.filter((p) => isFavorite(p.id));
  const nonFavorites = filtered.filter((p) => !isFavorite(p.id));

  function selectProject(project: ProjectType) {
    onChange(project.id, project);
    setIsOpen(false);
    setQuery('');
  }

  function renderRow(p: ProjectType) {
    const favorited = isFavorite(p.id);
    const breadcrumb = buildBreadcrumbLabel(projects, p.id);
    const parentLabel = breadcrumb.includes(' / ') ? breadcrumb.slice(0, breadcrumb.lastIndexOf(' / ')) : null;
    return (
      <div
        key={p.id}
        className="hover:bg-gray-100 dark:hover:bg-gray-700"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 8px 8px 8px' }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <span
          onClick={() => selectProject(p)}
          style={{ flex: 1, cursor: 'pointer' }}
        >
          <span style={{ fontSize: 14, display: 'block' }}>{p.name}</span>
          {parentLabel && (
            <span className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block' }}>{parentLabel}</span>
          )}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(p.id);
          }}
          title={favorited ? 'Remover dos favoritos' : 'Marcar como favorito'}
          className={favorited ? 'text-[#f6bf26]' : 'text-gray-300 dark:text-gray-600'}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 14,
            padding: '0 4px',
          }}
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
      onChange(id, {
        id,
        name,
        color: null,
        cover_path: null,
        archived: 0,
      });
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
          className="border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 8,
            borderRadius: 4,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          <span title={selectedBreadcrumb} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedBreadcrumb}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearSelection();
            }}
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            style={{ border: 'none', background: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      ) : (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar ou criar projeto..."
          className="border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          style={{ width: '100%', padding: 8, fontSize: 14, borderRadius: 4 }}
        />
      )}

      {isOpen && (
        <div
          className="border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            borderRadius: 4,
            maxHeight: 200,
            overflowY: 'auto',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div
            onClick={clearSelection}
            className="border-b border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
            style={{ padding: 8, fontSize: 13, cursor: 'pointer' }}
          >
            Sem projeto
          </div>

          {favorites.length > 0 && (
            <>
              <div className="text-gray-500 dark:text-gray-400" style={{ padding: '6px 8px 2px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                ★ Favoritos
              </div>
              {favorites.map(renderRow)}
              {nonFavorites.length > 0 && (
                <div className="border-t border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400" style={{ padding: '6px 8px 2px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  Todos os projetos
                </div>
              )}
            </>
          )}

          {nonFavorites.map(renderRow)}

          {query.trim() && !exactMatch && (
            <div
              onClick={handleCreate}
              className={`text-blue-600 hover:bg-gray-100 dark:text-blue-400 dark:hover:bg-gray-700 ${filtered.length > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}`}
              style={{
                padding: 8,
                fontSize: 14,
                cursor: creating ? 'default' : 'pointer',
                opacity: creating ? 0.6 : 1,
              }}
            >
              {creating ? 'Criando...' : `+ Criar projeto "${query.trim()}"`}
            </div>
          )}

          {filtered.length === 0 && !query.trim() && (
            <div className="text-gray-500 dark:text-gray-400" style={{ padding: 8, fontSize: 13 }}>Nenhum projeto ainda</div>
          )}
        </div>
      )}
    </div>
  );
}
