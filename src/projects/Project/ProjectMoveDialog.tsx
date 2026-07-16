import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import { getSubtreeIds } from '@/lib/utils/projectTree';
import type { ProjectType } from '@/types/project.types';

interface ProjectMoveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectType | null;
  allProjects: ProjectType[];
  onMove: (newParentId: string | null) => void;
}

export default function ProjectMoveDialog({ isOpen, onClose, project, allProjects, onMove }: ProjectMoveDialogProps) {
  if (!project) return null;

  const forbidden = new Set(getSubtreeIds(allProjects, project.id)); // não pode virar filho de si mesmo/descendente
  const candidates = allProjects.filter((p) => !forbidden.has(p.id));

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div style={{ padding: 16, width: 360, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Mover "{project.name}"</h3>

        <button
          onClick={() => { onMove(null); onClose(); }}
          disabled={project.parentProjectId === null}
          style={{ textAlign: 'left', padding: 8, fontSize: 13, border: '1px solid #eee', borderRadius: 4, cursor: 'pointer', opacity: project.parentProjectId === null ? 0.5 : 1 }}
        >
          📁 Tornar projeto principal (sem pai)
        </button>

        <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {candidates.map((p) => (
            <button
              key={p.id}
              onClick={() => { onMove(p.id); onClose(); }}
              disabled={p.id === project.parentProjectId}
              style={{ textAlign: 'left', padding: 8, fontSize: 13, border: '1px solid #eee', borderRadius: 4, cursor: 'pointer', opacity: p.id === project.parentProjectId ? 0.5 : 1 }}
            >
              {p.name}
            </button>
          ))}
        </div>

        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
      </div>
    </Modal>
  );
}
