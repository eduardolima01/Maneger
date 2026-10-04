import { useEffect, useMemo, useRef, useState } from 'react';
import AgendaHeader, { AgendaViewMode } from './AgendaHeader';
import TimeGridView from './TimeGridView';
import MonthView from './MonthView';
import CreateEventModal from './CreateEventModal';
import { useEvents } from '../lib/hooks/useEvents';
import type { Event } from '../types/event.types';
import { addDays, addMonths, startOfWeek, startOfDay, toLocalISO } from '../lib/utils/date';
import { usePersistentState } from './hooks/usePersistentState';

import { useProjectColors } from '../lib/hooks/useProjectColors';
import { useProjectCovers } from '../lib/hooks/project/useProjectCovers';

import { useNavigate } from '@tanstack/react-router';

import { useProjectBreadcrumbs } from '../lib/hooks/useProjectBreadcrumbs';
import ProjectQuickModal from '@/Projects/Project/ProjectQuickModal';
import { getProjectById } from '@/lib/api/projects';
import { ProjectType } from '@/types/project.types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useEventGalleryCovers } from './hooks/useEventGalleryCovers';
import EventStatsPanel from './components/EventStatsPanel';
import EventInfoPopup from './components/EventInfoPopup';
import QuickCreateEventMenu from './components/QuickCreateEventMenu';
import EventHistoryModal from './components/EventHistoryModal';
import { getEventDetails, createEventDetail } from './api/eventDetails';

function isViewMode(v: unknown): v is AgendaViewMode {
  return v === 'day' || v === 'week' || v === 'month';
}

export default function Agenda() {
  const navigate = useNavigate();
  const { resolveColor } = useProjectColors();
  // a visão (dia/semana/mês) fica salva e volta igual ao reabrir o app
  const [view, setView] = usePersistentState<AgendaViewMode>('agenda.view', 'week', isViewMode);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [draft, setDraft] = useState<{ start: Date; end: Date } | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [statsEvent, setStatsEvent] = useState<Event | null>(null);
  // popup de detalhamento: guarda também a capa exibida no card que o abriu
  const [infoPopup, setInfoPopup] = useState<{ event: Event; cover: string | null } | null>(null);
  const [historyEvent, setHistoryEvent] = useState<Event | null>(null);

  // criação rápida: menu com busca de projetos no ponto do clique, em vez do modal
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickPos, setQuickPos] = useState<{ x: number; y: number } | null>(null);
  // última posição do ponteiro (fase de captura: vale antes de qualquer handler que dispare o onCreateEvent)
  const lastPointer = useRef({ x: 200, y: 200 });
  useEffect(() => {
    const track = (e: PointerEvent) => { lastPointer.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('pointerdown', track, true);
    window.addEventListener('pointerup', track, true);
    return () => {
      window.removeEventListener('pointerdown', track, true);
      window.removeEventListener('pointerup', track, true);
    };
  }, []);

  const [modalInitialTab, setModalInitialTab] = useState<'event' | 'project'>('event');
  const [quickViewProject, setQuickViewProject] = useState<ProjectType | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  // Ctrl+Espaço: abre o menu de criação rápida no dia e na hora de agora (de novo, fecha).
  // Não dispara digitando em campos nem com outro modal/popup aberto.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || !e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
      if (quickOpen) {
        e.preventDefault();
        setQuickOpen(false);
        return;
      }
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      const overlayOpen =
        modalOpen || infoPopup !== null || historyEvent !== null || deleteTarget !== null || statsEvent !== null || quickViewOpen;
      if (typing || overlayOpen) return;
      e.preventDefault();
      openCreateAtNow();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [quickOpen, modalOpen, infoPopup, historyEvent, deleteTarget, statsEvent, quickViewOpen]);

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
  const { resolveEventImages, invalidateProject, hasAmbiguousAutoCover } = useEventGalleryCovers(events);

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
    setQuickPos(lastPointer.current);
    setQuickOpen(true);
  }

  /** Atalho: começa agora (arredondado para baixo a cada 5 min), 30 min de duração — o mesmo padrão de um clique na grade. */
  function openCreateAtNow() {
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(Math.floor(now.getMinutes() / 5) * 5, 0, 0);
    const end = new Date(start.getTime() + 30 * 60000);
    setDraft({ start, end });
    setEditingEvent(null);
    setQuickPos({ x: Math.round(window.innerWidth / 2 - 160), y: Math.round(window.innerHeight / 4) });
    setQuickOpen(true);
  }

  async function handleQuickCreate(data: { title: string; project_id: string | null }) {
    if (!draft) return;
    await create({ ...data, start_at: toLocalISO(draft.start), end_at: toLocalISO(draft.end) });
    setQuickOpen(false);
    setDraft(null);
  }

  // "Editor completo": o modal de antes, com o mesmo horário do rascunho
  function openFullEditor() {
    setQuickOpen(false);
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


  async function openProjectSummary(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return;
    setQuickViewProject(project);
    setQuickViewOpen(true);
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

  function requestDeleteEvent(event: Event) {
    setDeleteTarget({ id: event.id, title: event.title });
  }

  async function handleDuplicateEvent(sourceEvent: Event, startAt: string, endAt: string) {
    const created: unknown = await create({
      title: sourceEvent.title,
      project_id: sourceEvent.project_id,
      start_at: startAt,
      end_at: endAt,
    });

    // copia o detalhamento (linha do tempo) para o novo evento — a duração é a mesma, então os offsets valem como estão
    const newId = typeof created === 'string' ? created : (created as { id?: string } | null | undefined)?.id;
    if (!newId) {
      console.warn('[Agenda] duplicar: create() não devolveu o id do novo evento; detalhamento não foi copiado.');
      return;
    }
    try {
      const details = await getEventDetails(sourceEvent.id);
      const sorted = [...details].sort((a, b) => a.position - b.position);
      const durationMin = Math.max(0, Math.round((new Date(sourceEvent.end_at).getTime() - new Date(sourceEvent.start_at).getTime()) / 60000));
      for (const d of sorted) {
        await createEventDetail(newId, {
          start_offset: d.start_offset ?? 0,
          end_offset: d.end_offset ?? durationMin,
          content: d.content,
        });
      }
    } catch (err) {
      console.error('[Agenda] duplicar: falha ao copiar o detalhamento', err);
    }
  }

  function handleQuickAssignProject(eventId: string, projectId: string | null) {
    update(eventId, { project_id: projectId });
  }

  async function handleCreateSuggested(data: { title: string; project_id: string | null; start_at: string; end_at: string }) {
    await create(data);
  }

  async function handleDescriptionChange(eventId: string, description: string) {
    await update(eventId, { description });
  }

  async function handleProjectDrop(projectId: string, projectName: string, start: Date, end: Date) {
    await create({
      title: projectName || 'Novo evento',
      project_id: projectId,
      start_at: toLocalISO(start),
      end_at: toLocalISO(end),
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
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
              onEventClick={setStatsEvent}
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
              onEventRequestDelete={requestDeleteEvent}
              onEventHistory={setHistoryEvent}
              resolveEventImages={resolveEventImages}
              onProjectDrop={handleProjectDrop}
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
              onEventClick={setStatsEvent}
              onEventEdit={openEdit}
              onEventProjectClick={openEventProjectTab}
              onEventChange={(id, startAt, endAt) => update(id, { start_at: startAt, end_at: endAt })}
              onEventDuplicate={handleDuplicateEvent}
              onProjectAssign={handleQuickAssignProject}
              onProjectSummaryClick={openProjectSummary}
              onEventRequestDelete={requestDeleteEvent}
              resolveEventImages={resolveEventImages}
              onCreateSuggested={handleCreateSuggested}
              onDescriptionChange={handleDescriptionChange}
              onOpenInfoPopup={(ev, cover) => setInfoPopup({ event: ev, cover: cover ?? null })}
              onEventHistory={setHistoryEvent}
              onProjectDrop={handleProjectDrop}
            />
          )}
        </div>
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
        onGalleryChanged={invalidateProject}
        checkAmbiguousAutoCover={hasAmbiguousAutoCover}
      />

      <QuickCreateEventMenu
        open={quickOpen}
        position={quickPos}
        start={draft?.start ?? null}
        end={draft?.end ?? null}
        onClose={() => setQuickOpen(false)}
        onCreate={handleQuickCreate}
        onOpenFullEditor={openFullEditor}
      />

      <ProjectQuickModal
        isOpen={quickViewOpen}
        onClose={() => setQuickViewOpen(false)}
        project={quickViewProject}
        onGoToProject={() => {
          if (!quickViewProject) return;
          setQuickViewOpen(false);
          navigate({ to: '/projects/$projectId', params: { projectId: quickViewProject.id } });
        }}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Excluir evento?"
        message={`Deseja realmente excluir "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`}
        onConfirm={async () => {
          if (deleteTarget) await remove(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <EventStatsPanel
        event={statsEvent}
        onClose={() => setStatsEvent(null)}
        resolveColor={resolveColor}
        resolveBreadcrumb={resolveBreadcrumb}
      />

      <EventHistoryModal
        event={historyEvent}
        onClose={() => setHistoryEvent(null)}
        color={resolveColor(historyEvent?.project_id ?? null)}
        breadcrumb={resolveBreadcrumb(historyEvent?.project_id ?? null)}
      />

      <EventInfoPopup
        event={infoPopup?.event ?? null}
        onClose={() => setInfoPopup(null)}
        color={resolveColor(infoPopup?.event.project_id ?? null)}
        breadcrumb={resolveBreadcrumb(infoPopup?.event.project_id ?? null)}
        cover={infoPopup?.cover ?? null}
        onDescriptionChange={handleDescriptionChange}
      />
    </div>
  );
}
