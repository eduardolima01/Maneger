import { useEffect, useRef, useState } from 'react';
import { getAllKanbansWithProject } from '@/lib/api/kanban/kanbans';
import type { KanbanWithProject } from '@/types/kanban.types';
import { openKanbanTab } from './tabStore';

export default function NewTabPicker() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [kanbans, setKanbans] = useState<KanbanWithProject[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) getAllKanbansWithProject().then(setKanbans);
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const filtered = kanbans.filter((k) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return k.name.toLowerCase().includes(term) || k.projectName.toLowerCase().includes(term);
  });

  function handleSelect(kanban: KanbanWithProject) {
    openKanbanTab(kanban);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Nova aba"
        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '8px 12px', fontSize: 16 }}
      >
        +
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 20, width: 280,
          background: '#fff', border: '1px solid #ddd', borderRadius: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: 8,
        }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar Kanban..."
            style={{ width: '100%', padding: 6, marginBottom: 6, boxSizing: 'border-box' }}
          />
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <p style={{ fontSize: 13, color: '#999', padding: 8 }}>Nenhum Kanban encontrado.</p>
            )}
            {filtered.map((k) => (
              <div
                key={k.id}
                onClick={() => handleSelect(k)}
                style={{ padding: '6px 8px', cursor: 'pointer', fontSize: 14, borderRadius: 4 }}
              >
                📋 {k.name} <span style={{ color: '#999', fontSize: 12 }}>· {k.projectName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

