import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import type { ProjectType } from '@/types/project.types';
import type { ModuleCounts } from '@/lib/api/projectModuleCounts';
import CardProject from '@/Projects/components/CardProject';

interface SubprojectCardProps {
  project: ProjectType;
  counts?: ModuleCounts;
  onOpen?: () => void;
  onEditInPlace?: () => void; // presente = dentro de um quick view; substitui o onEdit (modal empilhado)
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onRequestDelete: () => void;
}

export default function SubprojectCard({ project, counts, onOpen, onEditInPlace, onEdit, onDuplicate, onMove, onRequestDelete }: SubprojectCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  const [menuOpen, setMenuOpen] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <span {...attributes} {...listeners} style={{ color: '#bbb', fontSize: 12, cursor: 'grab', touchAction: 'none', flexShrink: 0 }} title="Arrastar">⠿</span>

      <div style={{ flex: 1 }}>
        <CardProject project={project} onClick={onOpen} />
        {counts && (
          <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#999', marginTop: -4, marginLeft: 4 }}>
            <span>{counts.tasks} tasks</span>
            <span>{counts.kanban} kanban</span>
            <span>{counts.logs} logs</span>
          </div>
        )}
      </div>

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={() => setMenuOpen((v) => !v)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, padding: '2px 8px' }}>⋮</button>
        {menuOpen && (
          <div
            onMouseLeave={() => setMenuOpen(false)}
            style={{ position: 'absolute', right: 0, top: '100%', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', zIndex: 10, minWidth: 140 }}
          >
            {([
              ['Editar', onEditInPlace ?? onEdit],
              ['Duplicar', onDuplicate],
              ['Mover para...', onMove],
              ['Excluir', onRequestDelete],
            ] as [string, () => void][]).map(([label, action]) => (
              <button
                key={label}
                onClick={() => {
                  action();
                  setMenuOpen(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
