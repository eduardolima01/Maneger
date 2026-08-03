export type PomodoroSessionType = 'work' | 'short_break' | 'long_break';

export interface PomodoroSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsUntilLongBreak: number;
}

export interface PomodoroSession {
  id: string;
  type: PomodoroSessionType;
  startedAt: string;       // ISO local via toLocalISO
  completedAt: string | null; // null = interrompida antes de terminar
  durationMinutes: number;
  description?: string;
}

export interface PomodoroData {
  settings: PomodoroSettings;
  sessions: PomodoroSession[];
}

export function defaultPomodoroData(): PomodoroData {
  return {
    settings: { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsUntilLongBreak: 4 },
    sessions: [],
  };
}
