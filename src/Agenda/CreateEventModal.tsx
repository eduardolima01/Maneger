import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import { getProjectById } from '@/lib/api/projects';
import type { ProjectType } from '../types/project.types';
import { addDays, startOfDay, toLocalISO, formatDuration } from '../lib/utils/date';
import { Event } from '@/types/event.types';
import ProjectQuickView from '@/Projects/Project/ProjectQuickView';
import ProjectSearchSelect from '@/Projects/components/ProjectSearchSelect';
import TimePicker from '@/components/ui/TimePicker';

type EditorTab = 'event' | 'project';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftStart: Date | null;
  draftEnd: Date | null;
  editingEvent: Event | null;
  initialTab?: EditorTab;
  onSave: (data: { title: string; project_id: string | null; start_at: string; end_at: string }) => void;
  onDelete?: () => void;
  onGoToProject: (projectId: string) => void;
}

const DAY_OFFSET_OPTIONS = [
  { value: -1, label: 'Dia anterior' },
  { value: 0, label: 'Este dia' },
  { value: 1, label: 'Dia seguinte' },
];

const DURATION_PRESETS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1h30', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 },
  { label: '4h', minutes: 240 },
  { label: 'Dia inteiro', minutes: 24 * 60 },
];

function toTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayOffsetBetween(anchor: Date, date: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(date).getTime() - startOfDay(anchor).getTime()) / msPerDay);
}

function combineDateTime(anchor: Date, dayOffset: number, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const base = addDays(startOfDay(anchor), dayOffset);
  base.setHours(h, m, 0, 0);
  return base;
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

  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [startDayOffset, setStartDayOffset] = useState(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endDayOffset, setEndDayOffset] = useState(0);
  const [endTime, setEndTime] = useState('10:00');

  useEffect(() => {
    if (!isOpen) return;

    setTitle(editingEvent?.title ?? '');
    setProjectId(editingEvent?.project_id ?? null);
    setSelectedProject(null);
    setActiveTab(editingEvent?.project_id ? initialTab : 'event');

    const initialStart = editingEvent ? new Date(editingEvent.start_at) : draftStart ?? new Date();
    const initialEnd = editingEvent ? new Date(editingEvent.end_at) : draftEnd ?? new Date(initialStart.getTime() + 60 * 60000);

    setAnchorDate(startOfDay(initialStart));
    setStartDayOffset(0); // âncora é sempre o dia de início original
    setStartTime(toTimeInputValue(initialStart));
    setEndDayOffset(dayOffsetBetween(initialStart, initialEnd));
    setEndTime(toTimeInputValue(initialEnd));
  }, [isOpen, editingEvent, draftStart, draftEnd, initialTab]);

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

  const start = combineDateTime(anchorDate, startDayOffset, startTime);
  const end = combineDateTime(anchorDate, endDayOffset, endTime);
  const isValidRange = end.getTime() > start.getTime();
  const hasProjectTab = !!editingEvent?.project_id;

  function applyDurationPreset(minutes: number) {
    const newEnd = new Date(start.getTime() + minutes * 60000);
    setEndDayOffset(dayOffsetBetween(anchorDate, newEnd));
    setEndTime(toTimeInputValue(newEnd));
  }

  function handleGoToProject(projectId: string) {
    onClose();
    onGoToProject(projectId);
  }

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div style={{ padding: 16, paddingBottom: 200, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto' }}>
        {hasProjectTab && (
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e0e0e0', marginBottom: 12 }}>
            {(['event', 'project'] as EditorTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 14px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #1a73e8' : '2px solid transparent',
                  color: activeTab === tab ? '#1a73e8' : '#666', cursor: 'pointer',
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
              <ProjectQuickView project={linkedProject} onGoToProject={handleGoToProject} />
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
              style={{ width: '100%', padding: 8, marginBottom: 12, fontSize: 14 }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Início</label>
                <div style={{ display: 'flex', width: '100px', gap: 6 }}>
                  <select
                    value={startDayOffset}
                    onChange={(e) => setStartDayOffset(Number(e.target.value))}
                    style={{ flex: 1, padding: 6, fontSize: 12 }}
                  >
                    {DAY_OFFSET_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <TimePicker value={startTime} onChange={setStartTime} />
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Fim</label>
                <div style={{ display: 'flex', width: '100px', gap: 6 }}>
                  <select
                    value={endDayOffset}
                    onChange={(e) => setEndDayOffset(Number(e.target.value))}
                    style={{ flex: 1, padding: 6, fontSize: 12 }}
                  >
                    {DAY_OFFSET_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <TimePicker value={endTime} onChange={setEndTime} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Duração rápida</label>
              <select
                onChange={(e) => e.target.value && applyDurationPreset(Number(e.target.value))}
                value=""
                style={{ width: '100%', padding: 8, fontSize: 13 }}
              >
                <option value="">
                  {isValidRange ? `Personalizado (${formatDuration(Math.round((end.getTime() - start.getTime()) / 60000))})` : 'Selecione uma duração...'}
                </option>
                {DURATION_PRESETS.map((d) => (
                  <option key={d.minutes} value={d.minutes}>{d.label}</option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: 12, color: isValidRange ? '#666' : '#c62828', marginBottom: 16 }}>
              {isValidRange
                ? `${start.toLocaleDateString('pt-BR')} ${toTimeInputValue(start)} → ${end.toLocaleDateString('pt-BR')} ${toTimeInputValue(end)}`
                : 'O horário de fim precisa ser depois do início.'}
            </div>

            <div style={{ marginBottom: 16 }}>
              <ProjectSearchSelect
                value={projectId}
                onChange={(id, project) => { setProjectId(id); setSelectedProject(project); }}
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
                  disabled={!isValidRange}
                  onClick={() => {
                    const fallbackName = selectedProject?.name ?? '';
                    const finalTitle = title.trim() || fallbackName;
                    if (finalTitle && isValidRange) {
                      onSave({ title: finalTitle, project_id: projectId, start_at: toLocalISO(start), end_at: toLocalISO(end) });
                    }
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
