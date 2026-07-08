import { useEffect, useState } from 'react';
import Modal from '../components/ui/Modal';
import Button from '../components/layout/Button';
import { useProjects } from '../lib/hooks/useProjects';
import type { Event } from '../types/event.types';
import { formatTime } from '../lib/utils/date';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftStart: Date | null;
  draftEnd: Date | null;
  editingEvent: Event | null;
  onSave: (data: { title: string; project_id: string | null }) => void;
  onDelete?: () => void;
}

export default function CreateEventModal({ isOpen, onClose, draftStart, draftEnd, editingEvent, onSave, onDelete }: CreateEventModalProps) {
  const { projects } = useProjects();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(editingEvent?.title ?? '');
      setProjectId(editingEvent?.project_id ?? null);
    }
  }, [isOpen, editingEvent]);

  const start = editingEvent ? new Date(editingEvent.start_at) : draftStart;
  const end = editingEvent ? new Date(editingEvent.end_at) : draftEnd;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div style={{ padding: 16, minWidth: 280 }}>
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

        <select
          value={projectId ?? ''}
          onChange={(e) => setProjectId(e.target.value ? e.target.value : null)}
          style={{ width: '100%', padding: 8, marginBottom: 16, fontSize: 14 }}
        >
          <option value="">Sem projeto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

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
              onClick={() => title.trim() && onSave({ title: title.trim(), project_id: projectId })}
            >
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
