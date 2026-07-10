import { useEffect, useRef, useState } from 'react';
import { createProject } from '@/lib/api/projects';
import { useProjects } from '@/lib/hooks/useProjects';
import { useFavoriteProjects } from '@/lib/hooks/useFavoriteProjects';
import type { ProjectType } from '@/types/project.types';

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
    return (
      <div
        key={p.id}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 8px 8px 8px' }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <span
          onClick={() => selectProject(p)}
          style={{ flex: 1, fontSize: 14, cursor: 'pointer' }}
        >
          {p.name}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(p.id);
          }}
          title={favorited ? 'Remover dos favoritos' : 'Marcar como favorito'}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 14,
            color: favorited ? '#f6bf26' : '#ccc',
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
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 8,
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          <span>{selectedProject.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearSelection();
            }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#666' }}
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
          style={{ width: '100%', padding: 8, fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}
        />
      )}

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            border: '1px solid #ccc',
            borderRadius: 4,
            backgroundColor: '#fff',
            maxHeight: 200,
            overflowY: 'auto',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div
            onClick={clearSelection}
            style={{ padding: 8, fontSize: 13, color: '#666', cursor: 'pointer', borderBottom: '1px solid #eee' }}
          >
            Sem projeto
          </div>

          {favorites.length > 0 && (
            <>
              <div style={{ padding: '6px 8px 2px', fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>
                ★ Favoritos
              </div>
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
            <div
              onClick={handleCreate}
              style={{
                padding: 8,
                fontSize: 14,
                cursor: creating ? 'default' : 'pointer',
                color: '#1a73e8',
                borderTop: filtered.length > 0 ? '1px solid #eee' : undefined,
                opacity: creating ? 0.6 : 1,
              }}
            >
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
