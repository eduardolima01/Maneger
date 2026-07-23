import { useMemo, useState } from 'react';
import AgendaHeader, { AgendaViewMode } from './AgendaHeader';
import TimeGridView from './TimeGridView';
import MonthView from './MonthView';
import CreateEventModal from './CreateEventModal';
import { useEvents } from '../lib/hooks/useEvents';
import type { Event } from '../types/event.types';
import { addDays, addMonths, startOfWeek, startOfDay, toLocalISO } from '../lib/utils/date';

import { useProjectColors } from '../lib/hooks/useProjectColors';
import { useProjectCovers } from '../lib/hooks/project/useProjectCovers';

import { useNavigate } from '@tanstack/react-router';

import { useProjectBreadcrumbs } from '../lib/hooks/useProjectBreadcrumbs';

export default function Agenda() {
  const navigate = useNavigate();
  const { resolveColor } = useProjectColors();
  const [view, setView] = useState<AgendaViewMode>('week');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [draft, setDraft] = useState<{ start: Date; end: Date } | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [modalInitialTab, setModalInitialTab] = useState<'event' | 'project'>('event');

  const { resolveCover } = useProjectCovers();
  const { resolveBreadcrumb } = useProjectBreadcrumbs();

  const { rangeStart, rangeEnd, days, label } = useMemo(() => {
    if (view === 'day') {
      const start = startOfDay(anchor);
      return { rangeStart: start, rangeEnd: addDays(start, 1), days: [start], label: start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) };
    }
    if (view === 'week') {
      const start = startOfWeek(anchor);
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return { rangeStart: start, rangeEnd: addDays(start, 7), days, label: `${start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${addDays(start, 6).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}` };
    }
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    return { rangeStart: start, rangeEnd: end, days: [], label: anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) };
  }, [view, anchor]);

  const { events, create, update, remove } = useEvents(toLocalISO(rangeStart), toLocalISO(rangeEnd));

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
    setModalInitialTab('event');
    setModalOpen(true);
  }

  async function handleSave(data: { title: string; project_id: string | null; start_at: string; end_at: string }) {
    if (editingEvent) {
      await update(editingEvent.id, data);
    } else if (draft) {
      await create(data);
    }
    setModalOpen(false);
  }

  function openEventProjectTab(event: Event) {
    if (!event.project_id) return;
    setEditingEvent(event);
    setDraft(null);
    setModalInitialTab('project');
    setModalOpen(true);
  }


  function handleCardDoubleClick(event: Event) {
    if (event.project_id) {
      openEventProjectTab(event);
    } else {
      openEdit(event);
    }
  }

  async function handleDelete() {
    if (editingEvent) {
      await remove(editingEvent.id);
      setModalOpen(false);
    }
  }

  async function handleDuplicateEvent(sourceEvent: Event, startAt: string, endAt: string) {
    await create({
      title: sourceEvent.title,
      project_id: sourceEvent.project_id,
      start_at: startAt,
      end_at: endAt,
    });
  }

  function handleQuickAssignProject(eventId: string, projectId: string | null) {
    update(eventId, { project_id: projectId });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
          <MonthView
            anchor={anchor}
            events={events}
            resolveColor={resolveColor}
            resolveCover={resolveCover}
            onDayClick={(day) => {
              setAnchor(day);
              setView('day');
            }}
            resolveBreadcrumb={resolveBreadcrumb}
            onEventProjectClick={openEventProjectTab}
            onEventEdit={openEdit}
            onEventDoubleClick={handleCardDoubleClick}
            onCreateEvent={(day) => {
              const start = new Date(day);
              start.setHours(9, 0, 0, 0);
              const end = new Date(day);
              end.setHours(10, 0, 0, 0);
              openCreate(start, end);
            }}
            onEventChange={(id, startAt, endAt) => update(id, { start_at: startAt, end_at: endAt })}
            onEventDuplicate={handleDuplicateEvent}
            onProjectAssign={handleQuickAssignProject}
          />
        ) : (
          <TimeGridView
            days={days}
            events={events}
            onCreateEvent={openCreate}
            resolveColor={resolveColor}
            resolveCover={resolveCover}
            resolveBreadcrumb={resolveBreadcrumb}
            onEventDoubleClick={handleCardDoubleClick}
            onEventEdit={openEdit}
            onEventProjectClick={openEventProjectTab}
            onEventChange={(id, startAt, endAt) => update(id, { start_at: startAt, end_at: endAt })}
            onEventDuplicate={handleDuplicateEvent}
            onProjectAssign={handleQuickAssignProject}
          />
        )}
      </div>

      <CreateEventModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        draftStart={draft?.start ?? null}
        draftEnd={draft?.end ?? null}
        editingEvent={editingEvent}
        onSave={handleSave}
        onDelete={handleDelete}
        initialTab={modalInitialTab}
        onGoToProject={(projectId) => navigate({
          to: '/projects/$projectId',
          params: { projectId }
        })}
      />
    </div>
  );
}

