import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import { getProjectById } from '@/lib/api/projects';
import type { Event } from '@/types/event.types';
import type { ProjectType } from '../types/project.types';
import { formatTime } from '../lib/utils/date';
import ProjectSearchSelect from '@/Projects/components/ProjectSearchSelect';
import ProjectQuickView from '@/Projects/Project/ProjectQuickView';

type EditorTab = 'event' | 'project';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftStart: Date | null;
  draftEnd: Date | null;
  editingEvent: Event | null;
  initialTab?: EditorTab;
  onSave: (data: { title: string; project_id: string | null }) => void;
  onDelete?: () => void;
  onGoToProject: (projectId: string) => void;
}

export default function CreateEventModal({
  isOpen,
  onClose,
  draftStart,
  draftEnd,
  editingEvent,
  initialTab = 'event',
  onSave,
  onDelete,
  onGoToProject,
}: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectType | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>('event');
  const [linkedProject, setLinkedProject] = useState<ProjectType | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(editingEvent?.title ?? '');
      setProjectId(editingEvent?.project_id ?? null);
      setSelectedProject(null);
      setActiveTab(editingEvent?.project_id ? initialTab : 'event');
    }
  }, [isOpen, editingEvent, initialTab]);

  useEffect(() => {
    if (isOpen && editingEvent?.project_id) {
      setLoadingProject(true);
      getProjectById(editingEvent.project_id).then((p) => {
        setLinkedProject(p);
        setLoadingProject(false);
      });
    } else {
      setLinkedProject(null);
    }
  }, [isOpen, editingEvent?.project_id]);

  const start = editingEvent ? new Date(editingEvent.start_at) : draftStart;
  const end = editingEvent ? new Date(editingEvent.end_at) : draftEnd;
  const hasProjectTab = !!editingEvent?.project_id;

  function handleGoToProject() {
    if (!linkedProject) return;
    onClose();
    onGoToProject(linkedProject.id);
  }

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div style={{ padding: 16, width: 640, maxWidth: '90vw', height: 640, maxHeight: '90vw' }}>
        {hasProjectTab && (
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e0e0e0', marginBottom: 12 }}>
            {(['event', 'project'] as EditorTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #1a73e8' : '2px solid transparent',
                  color: activeTab === tab ? '#1a73e8' : '#666',
                  cursor: 'pointer',
                }}
              >
                {tab === 'event' ? 'Evento' : 'Projeto'}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'project' && hasProjectTab ? (
          <>
            {loadingProject && <p style={{ color: '#666', fontSize: 14 }}>Carregando projeto...</p>}
            {!loadingProject && linkedProject && (
              <ProjectQuickView
                project={linkedProject}
                onGoToProject={handleGoToProject}
              />
            )}
          </>
        ) : (
          <>
            <h3 style={{ marginTop: 0 }}>{editingEvent ? 'Editar evento' : 'Novo evento'}</h3>

            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do evento"
              style={{ width: '100%', padding: 8, marginBottom: 8, fontSize: 14 }}
            />

            {start && end && (
              <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                {start.toLocaleDateString('pt-BR')} · {formatTime(start)} — {formatTime(end)}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <ProjectSearchSelect
                value={projectId}
                onChange={(id, project) => {
                  setProjectId(id);
                  setSelectedProject(project);
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                {editingEvent && onDelete && (
                  <Button variant="danger" onClick={onDelete}>Excluir</Button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    const fallbackName = selectedProject?.name ?? '';
                    const finalTitle = title.trim() || fallbackName;
                    if (finalTitle) onSave({ title: finalTitle, project_id: projectId });
                  }}
                >
                  Salvar
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
