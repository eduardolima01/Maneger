import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import ProjectQuickView from './ProjectQuickView';
import type { ProjectType } from '../../types/project.types';

interface ProjectQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectType;
  onGoToProject: () => void;
}

export default function ProjectQuickModal({ isOpen, onClose, project, onGoToProject }: ProjectQuickModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose}>
      <div style={{ padding: 16, minWidth: 480, maxWidth: '90vw' }}>
        <ProjectQuickView project={project} onGoToProject={onGoToProject} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}
