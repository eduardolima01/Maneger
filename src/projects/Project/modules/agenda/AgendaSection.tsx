import { useMemo, useState } from 'react';
import AgendaHeader, { AgendaViewMode } from '@/Agenda/AgendaHeader';
import ProjectTimeGridView from './components/ProjectTimeGridView';
import ProjectMonthView from './components/ProjectMonthView';
import EventFormModal from '../event/EventFormModal';
import { useProjectEvents } from '@/lib/hooks/useProjectEvents';
import type { Event } from '@/types/event.types';
import { addDays, addMonths, startOfWeek, startOfDay } from '@/lib/utils/date';

interface AgendaSectionProps {
  projectId: string;
  projectName: string;
}

export default function AgendaSection({ projectId, projectName }: AgendaSectionProps) {
  const { events, create, update, remove } = useProjectEvents(projectId);

  const [view, setView] = useState<AgendaViewMode>('week');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [draft, setDraft] = useState<{ start: Date; end: Date } | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { days, label } = useMemo(() => {
    if (view === 'day') {
      const start = startOfDay(anchor);
      return { days: [start], label: start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) };
    }
    if (view === 'week') {
      const start = startOfWeek(anchor);
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return { days, label: `${start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${addDays(start, 6).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}` };
    }
    return { days: [], label: anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) };
  }, [view, anchor]);

  function goPrev() {
    if (view === 'day') setAnchor((d) => addDays(d, -1));
    else if (view === 'week') setAnchor((d) => addDays(d, -7));
    else setAnchor((d) => addMonths(d, -1));
  }

  function goNext() {
    if (view === 'day') setAnchor((d) => addDays(d, 1));
    else if (view === 'week') setAnchor((d) => addDays(d, 7));
    else setAnchor((d) => addMonths(d, 1));
  }

  function openCreate(start: Date, end: Date) {
    setDraft({ start, end });
    setEditingEvent(null);
    setModalOpen(true);
  }

  function openEdit(event: Event) {
    setEditingEvent(event);
    setDraft(null);
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

  async function handleDuplicateEvent(sourceEvent: Event, startAt: string, endAt: string) {
    await create({ title: sourceEvent.title, start_at: startAt, end_at: endAt });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 600 }}>
      <AgendaHeader
        label={label}
        view={view}
        onViewChange={setView}
        onPrev={goPrev}
        onNext={goNext}
        onToday={() => setAnchor(startOfDay(new Date()))}
      />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'month' ? (
          <ProjectMonthView
            anchor={anchor}
            events={events}
            onDayClick={(day) => { setAnchor(day); setView('day'); }}
            onEventEdit={openEdit}
            onEventDoubleClick={openEdit}
            onCreateEvent={(day) => {
              const start = new Date(day);
              start.setHours(9, 0, 0, 0);
              const end = new Date(day);
              end.setHours(10, 0, 0, 0);
              openCreate(start, end);
            }}
            onEventChange={(id, startAt, endAt) => update(id, { start_at: startAt, end_at: endAt })}
            onEventDuplicate={handleDuplicateEvent}
          />
        ) : (
          <ProjectTimeGridView
            days={days}
            events={events}
            onCreateEvent={openCreate}
            onEventEdit={openEdit}
            onEventDoubleClick={openEdit}
            onEventChange={(id, startAt, endAt) => update(id, { start_at: startAt, end_at: endAt })}
            onEventDuplicate={handleDuplicateEvent}
          />
        )}
      </div>

      <EventFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingEvent={editingEvent}
        projectName={projectName}
        draftStart={draft?.start ?? null}
        draftEnd={draft?.end ?? null}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
