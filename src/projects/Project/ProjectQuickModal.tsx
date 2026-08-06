import Modal from '@/components/ui/Modal';
import { ProjectFullView } from './ProjectFullView';
import type { ProjectType } from '../../types/project.types';

interface ProjectQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectType | null;
  onGoToProject: (projectId: string) => void;
}

export default function ProjectQuickModal({ isOpen, onClose, project }: ProjectQuickModalProps) {
  if (!project) return null;
  return (
    <Modal open={isOpen} onClose={onClose}>
      <div style={{ padding: 16, width: '85vw', maxWidth: 1100, maxHeight: '85vh', overflowY: 'auto' }}>
        <ProjectFullView
          projectId={project.id}
          reportTabMeta={false}
          onInternalNavigate={onClose}
        />
      </div>
    </Modal>
  );
}
