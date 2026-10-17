// tipos/workout.types.ts
// Apenas declarações de tipo — removidas pelo transform "typescript" do sucrase
// no build. Servem para tipagem forte enquanto você edita os arquivos-fonte.

interface Category {
  id: string;
  name: string;
  custom: boolean;
}

interface Exercise {
  id: string;
  name: string;
  categoryId: string;
  notes: string;
  photo?: string | null; // data URL (base64), já redimensionada/comprimida no cliente
}

interface WorkoutSet {
  id: string;
  reps: number | string;
  weight: number | string;
  restSec: number | string;
  notes: string;
  completed: boolean;
}

interface SessionEntry {
  exerciseId: string;
  exerciseName: string;
  completed: boolean;
  sets: WorkoutSet[];
}

interface FinishedSession {
  id: string;
  planId: string | null;
  planName: string;
  date: string;
  durationMin: number;
  endedAt: number;
  entries: SessionEntry[];
  notes: string;
}

interface Plan {
  id: string;
  name: string;
  exerciseIds: string[];
}

type WeekDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

type WeekSchedule = Record<WeekDayKey, string | null>;

interface WeekGroup {
  weekStart: string; // segunda-feira da semana, YYYY-MM-DD
  label: string;
  sessions: FinishedSession[];
  totalVolume: number;
}

interface WorkoutData {
  version: number;
  categories: Category[];
  exercises: Exercise[];
  plans: Plan[];
  sessions: FinishedSession[];
  weekSchedule: WeekSchedule;
}

interface ModApi {
  projectId: string;
  projectName: string;
  storage: {
    get: () => Promise<Record<string, unknown>>;
    set: (data: Record<string, unknown>) => Promise<void>;
  };
}

interface ExerciseHistoryRow {
  date: string;
  reps: number | string;
  weight: number | string;
  restSec: number | string;
  notes: string;
}
