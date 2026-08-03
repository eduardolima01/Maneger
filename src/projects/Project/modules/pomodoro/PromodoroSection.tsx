import { useEffect, useState } from 'react';
import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import { usePomodoroData } from './hooks/usePomodoroData';
import {
  useGlobalPomodoro, startPomodoro, pausePomodoro, skipPomodoro,
  setPomodoroDescription, setPomodoroSettings,
  cancelPomodoro,
} from './store/pomodoroTimerStore';
import type { PomodoroSession, PomodoroSettings } from './types/pomodoro.types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface PomodoroSectionProps {
  projectId: string;
  projectName: string;
}

const TYPE_LABELS: Record<string, string> = { work: 'Foco', short_break: 'Pausa curta', long_break: 'Pausa longa' };

export default function PomodoroSection({ projectId, projectName }: PomodoroSectionProps) {
  const { data, loading, reload, updateSettings, addManualSession, updateSession, deleteSession } = usePomodoroData(projectId);
  const pomodoro = useGlobalPomodoro();

  const isControllingTimer = pomodoro.activeProjectId === null || pomodoro.activeProjectId === projectId;

  const [descriptionInput, setDescriptionInput] = useState(pomodoro.activeProjectId === projectId ? pomodoro.description : '');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<PomodoroSettings>(data.settings);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState('');
  const [deletingSession, setDeletingSession] = useState<PomodoroSession | null>(null);

  useEffect(() => { setSettingsDraft(data.settings); }, [data.settings]);

  // o timer global persistiu uma rodada deste projeto — recarrega o histórico
  useEffect(() => {
    if (pomodoro.activeProjectId === projectId) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomodoro.persistTick]);

  if (loading) return <p>Carregando...</p>;

  const displayType = pomodoro.activeProjectId === projectId ? pomodoro.currentType : 'work';
  const displaySeconds = pomodoro.activeProjectId === projectId ? pomodoro.secondsLeft : data.settings.workMinutes * 60;
  const running = pomodoro.activeProjectId === projectId && pomodoro.running;

  const minutes = String(Math.floor(displaySeconds / 60)).padStart(2, '0');
  const seconds = String(displaySeconds % 60).padStart(2, '0');

  function handleSaveSettings() {
    updateSettings(settingsDraft);
    if (isControllingTimer) setPomodoroSettings(projectId, settingsDraft);
    setSettingsOpen(false);
  }

  function handleDescriptionChange(value: string) {
    setDescriptionInput(value);
    if (isControllingTimer) setPomodoroDescription(value);
  }

  function handleAddManualSession() {
    addManualSession({
      id: generateId(), type: 'work',
      startedAt: toLocalISO(new Date()), completedAt: toLocalISO(new Date()),
      durationMinutes: data.settings.workMinutes, description: '',
    });
  }

  function startEditingSession(session: PomodoroSession) {
    setEditingSessionId(session.id);
    setEditingDescription(session.description ?? '');
  }

  function commitEditingSession() {
    if (editingSessionId) updateSession(editingSessionId, { description: editingDescription.trim() || undefined });
    setEditingSessionId(null);
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={() => setSettingsOpen((o) => !o)} style={{ fontSize: 13 }}>⚙ Configurações</button>
      </div>

      {settingsOpen && (
        <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: 12, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {([
            ['workMinutes', 'Foco (min)'],
            ['shortBreakMinutes', 'Pausa curta (min)'],
            ['longBreakMinutes', 'Pausa longa (min)'],
            ['sessionsUntilLongBreak', 'Rodadas até pausa longa'],
          ] as const).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              {label}
              <input
                type="number" min={1} value={settingsDraft[key]}
                onChange={(e) => setSettingsDraft((prev) => ({ ...prev, [key]: Math.max(1, Number(e.target.value) || 1) }))}
                style={{ width: 60, padding: 4 }}
              />
            </label>
          ))}
          <button onClick={handleSaveSettings} style={{ marginTop: 4, padding: '6px 12px' }}>Salvar</button>
        </div>
      )}

      {!isControllingTimer && (
        <p style={{ fontSize: 12, color: '#c77', textAlign: 'center', marginBottom: 8 }}>
          Já existe um Pomodoro rodando em "{pomodoro.activeProjectName}". Finalize-o pra iniciar aqui.
        </p>
      )}

      <div style={{ textAlign: 'center' }}>
        <h3 style={{ marginBottom: 8 }}>{TYPE_LABELS[displayType]}</h3>
        <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 12 }}>{minutes}:{seconds}</div>

        <input
          value={descriptionInput}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="No que você está trabalhando nesta rodada?"
          disabled={!isControllingTimer}
          style={{ width: '100%', padding: 8, marginBottom: 12, boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {!running
            ? <button onClick={() => startPomodoro(projectId, projectName, data.settings)} disabled={!isControllingTimer} style={{ padding: '8px 16px' }}>▶ Iniciar</button>
            : <button onClick={pausePomodoro} style={{ padding: '8px 16px' }}>⏸ Pausar</button>}
          <button onClick={skipPomodoro} disabled={!isControllingTimer} style={{ padding: '8px 16px' }}>⏭ Pular</button>
          <button onClick={cancelPomodoro} disabled={!isControllingTimer} style={{ padding: '8px 16px' }}>✕ Cancelar</button>
        </div>
      </div>

      <div style={{ marginTop: 24, textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h4 style={{ fontSize: 13, color: '#666', margin: 0 }}>Histórico</h4>
          <button onClick={handleAddManualSession} style={{ fontSize: 12 }}>+ Adicionar manualmente</button>
        </div>

        {data.sessions.length === 0 && <p style={{ fontSize: 13, color: '#999' }}>Nenhuma sessão ainda.</p>}

        {data.sessions.map((s) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ flex: 1, fontSize: 13 }}>
              <div>{TYPE_LABELS[s.type]} — {s.durationMinutes}min {s.completedAt ? '✓' : '(interrompida)'}</div>
              {editingSessionId === s.id ? (
                <input
                  autoFocus value={editingDescription} onChange={(e) => setEditingDescription(e.target.value)}
                  onBlur={commitEditingSession}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitEditingSession(); if (e.key === 'Escape') setEditingSessionId(null); }}
                  style={{ width: '100%', fontSize: 12, padding: 2, marginTop: 2 }}
                />
              ) : (
                <div onClick={() => startEditingSession(s)} style={{ fontSize: 12, color: s.description ? '#666' : '#bbb', cursor: 'pointer', marginTop: 2 }}>
                  {s.description || 'sem descrição — clique pra adicionar'}
                </div>
              )}
            </div>
            <button onClick={() => setDeletingSession(s)} aria-label="Excluir sessão" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c00', fontSize: 13 }}>🗑</button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={deletingSession !== null}
        title="Excluir sessão"
        message={`Excluir esta rodada de ${deletingSession ? TYPE_LABELS[deletingSession.type] : ''} do histórico? Essa ação não pode ser desfeita.`}
        onConfirm={() => { if (deletingSession) deleteSession(deletingSession.id); setDeletingSession(null); }}
        onCancel={() => setDeletingSession(null)}
      />
    </div>
  );
}
