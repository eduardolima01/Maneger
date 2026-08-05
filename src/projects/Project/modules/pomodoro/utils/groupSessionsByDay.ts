import type { PomodoroSession } from '../types/pomodoro.types';

export interface PomodoroDayGroup {
  date: string; // YYYY-MM-DD
  sessions: PomodoroSession[];
  completedWorkCount: number;
  totalFocusMinutes: number;
}

export function groupSessionsByDay(sessions: PomodoroSession[]): PomodoroDayGroup[] {
  const map = new Map<string, PomodoroSession[]>();
  for (const s of sessions) {
    const day = s.startedAt.slice(0, 10); // startedAt é ISO local (toLocalISO) — os 10 primeiros chars já são a data local certa, sem risco de fuso
    const list = map.get(day) ?? [];
    list.push(s);
    map.set(day, list);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1)) // mais recente primeiro
    .map(([date, daySessions]) => {
      const completedWork = daySessions.filter((s) => s.type === 'work' && s.completedAt !== null);
      return {
        date,
        sessions: daySessions,
        completedWorkCount: completedWork.length,
        totalFocusMinutes: completedWork.reduce((sum, s) => sum + s.durationMinutes, 0),
      };
    });
}

// Constrói a data local (não UTC) pra comparar "hoje"/"ontem" sem cair no bug de fuso perto da meia-noite
function localDateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDayLabel(date: string): string {
  if (date === localDateString(0)) return 'Hoje';
  if (date === localDateString(-1)) return 'Ontem';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}
