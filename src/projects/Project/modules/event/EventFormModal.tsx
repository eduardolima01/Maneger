import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import type { Event } from '@/types/event.types';
import { toLocalISO, fromLocalISO } from '@/lib/utils/date';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingEvent: Event | null;
  projectName: string;
  onSave: (data: { title: string; start_at: string; end_at: string }) => void;
  onDelete?: () => void;
}


function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventFormModal({
  isOpen,
  onClose,
  editingEvent,
  onSave,
  onDelete,
  projectName
}: EventFormModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');

  useEffect(() => {
    if (!isOpen) return;

    if (editingEvent) {
      const start = fromLocalISO(editingEvent.start_at);
      const end = fromLocalISO(editingEvent.end_at);
      setTitle(editingEvent.title);
      setDate(toDateInput(start));
      setStartTime(toTimeInput(start));
      setEndTime(toTimeInput(end));
    } else {
      const now = new Date();
      setTitle('');
      setDate(toDateInput(now));
      setStartTime('09:00');
      setEndTime('10:00');
    }
  }, [isOpen, editingEvent]);

  function handleSubmit() {
    const finalTitle = title.trim() || projectName;
    if (!finalTitle || !date) return;

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const [y, m, d] = date.split('-').map(Number);

    const start = new Date(y, m - 1, d, sh, sm);
    let end = new Date(y, m - 1, d, eh, em);
    if (end <= start) end = new Date(start.getTime() + 60 * 60000); // fallback: +1h se hora final inválida

    onSave({ title: finalTitle, start_at: toLocalISO(start), end_at: toLocalISO(end) });
  }

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

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ width: '100%', padding: 8, marginBottom: 8, fontSize: 14 }}
        />

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={{ flex: 1, padding: 8, fontSize: 14 }}
          />
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            style={{ flex: 1, padding: 8, fontSize: 14 }}
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
            <Button variant="primary" onClick={handleSubmit}>Salvar</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
