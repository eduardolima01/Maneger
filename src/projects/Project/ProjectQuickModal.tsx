import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import ProjectModuleTabs from './modules/ProjectModuleTabs';
import { useProjectModules } from '@/lib/hooks/useProjectModules';
import type { ProjectType } from '../../types/project.types';

import ModuleToggles from './modules/ModuleToggles';

interface ProjectQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectType;
  onGoToProject: () => void;
}

export default function ProjectQuickModal({ isOpen, onClose, project, onGoToProject }: ProjectQuickModalProps) {
  const { modules, loading, toggle } = useProjectModules(project.id);
  const [showModuleSettings, setShowModuleSettings] = useState(false);

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div style={{ padding: 16, minWidth: 480, maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{project.name}</h3>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowModuleSettings((v) => !v)}
              title="Configurar módulos"
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #ccc',
                borderRadius: 4,
                background: showModuleSettings ? '#f0f0f0' : '#fff',
                cursor: 'pointer',
              }}
            >
              ⚙
            </button>
            <Button variant="secondary" onClick={onGoToProject}>Ir para o projeto</Button>
          </div>

          {showModuleSettings && modules && (
            <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: 12, backgroundColor: '#fafafa' }}>
              <ModuleToggles modules={modules} onToggle={toggle} />
            </div>
          )}

        </div>

        {loading && <p style={{ color: '#666', fontSize: 14 }}>Carregando módulos...</p>}

        {!loading && modules && (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <ProjectModuleTabs projectId={project.id} projectName={project.name} modules={modules} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: 12 }}>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}
