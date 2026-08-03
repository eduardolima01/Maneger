import { useCallback, useEffect, useState } from 'react';
import { loadPomodoroData, savePomodoroData, appendPomodoroSession } from '../api/pomodoroData';
import type { PomodoroData, PomodoroSession, PomodoroSettings } from '../types/pomodoro.types';
import { defaultPomodoroData } from '../types/pomodoro.types';

export function usePomodoroData(projectId: string) {
  const [data, setData] = useState<PomodoroData>(defaultPomodoroData());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    loadPomodoroData(projectId).then(setData);
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    loadPomodoroData(projectId).then((d) => { setData(d); setLoading(false); });
  }, [projectId]);

  const updateSettings = useCallback((settings: PomodoroSettings) => {
    setData((prev) => {
      const next = { ...prev, settings };
      savePomodoroData(projectId, next);
      return next;
    });
  }, [projectId]);

  const addManualSession = useCallback(async (session: PomodoroSession) => {
    await appendPomodoroSession(projectId, session);
    reload();
  }, [projectId, reload]);

  const updateSession = useCallback((id: string, patch: Partial<Omit<PomodoroSession, 'id'>>) => {
    setData((prev) => {
      const next = { ...prev, sessions: prev.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
      savePomodoroData(projectId, next);
      return next;
    });
  }, [projectId]);

  const deleteSession = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, sessions: prev.sessions.filter((s) => s.id !== id) };
      savePomodoroData(projectId, next);
      return next;
    });
  }, [projectId]);

  return { data, loading, reload, updateSettings, addManualSession, updateSession, deleteSession };
}
