import { useState } from 'react';
import Button from '@/components/layout/Button';
import EventFormModal from '../event/EventFormModal';
import { useProjectEvents } from '@/lib/hooks/useProjectEvents';
import type { Event } from '@/types/event.types';
import { fromLocalISO, formatTime } from '@/lib/utils/date';

interface AgendaSectionProps {
  projectId: string;
  projectName: string;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AgendaSection({
  projectId,
  projectName
}: AgendaSectionProps) {
  const { events, loading, create, update, remove } = useProjectEvents(projectId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  function openCreate() {
    setEditingEvent(null);
    setModalOpen(true);
  }

  function openEdit(event: Event) {
    setEditingEvent(event);
    setModalOpen(true);
  }

  async function handleSave(data: { title: string; start_at: string; end_at: string }) {
    if (editingEvent) {
      await update(editingEvent.id, data);
    } else {
      await create(data);
    }
    setModalOpen(false);
  }

  async function handleDelete() {
    if (editingEvent) {
      await remove(editingEvent.id);
      setModalOpen(false);
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Agenda</h3>
        <Button variant="primary" onClick={openCreate}>+ Novo evento</Button>
      </div>

      {loading && <p style={{ color: '#666', fontSize: 14 }}>Carregando...</p>}

      {!loading && events.length === 0 && (
        <p style={{ color: '#666', fontSize: 14 }}>Nenhum evento vinculado a este projeto ainda.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {events.map((ev) => {
          const start = fromLocalISO(ev.start_at);
          const end = fromLocalISO(ev.end_at);
          return (
            <div
              key={ev.id}
              onClick={() => openEdit(ev)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontWeight: 500 }}>{ev.title}</span>
              <span style={{ color: '#666', fontSize: 13 }}>
                {formatDate(start)} · {formatTime(start)}–{formatTime(end)}
              </span>
            </div>
          );
        })}
      </div>

      <EventFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingEvent={editingEvent}
        projectName={projectName}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
