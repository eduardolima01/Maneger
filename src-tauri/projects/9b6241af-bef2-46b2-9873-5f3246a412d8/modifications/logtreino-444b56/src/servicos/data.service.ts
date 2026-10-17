// servicos/data.service.ts
// Formato inicial dos dados e normalização defensiva (garante que campos
// nunca fiquem undefined mesmo se o data.json for editado manualmente
// ou vier de uma versão mais antiga da Modificação).

function defaultCategoryNames(): string[] {
  return ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Pernas', 'Abdômen', 'Cardio', 'Alongamento', 'Outros'];
}

function defaultData(): WorkoutData {
  return {
    version: 1,
    categories: defaultCategoryNames().map((name) => ({ id: uid('cat'), name, custom: false })),
    exercises: [],
    plans: [],
    sessions: [],
    weekSchedule: emptyWeekSchedule(),
  };
}

function normalizeData(raw: any): WorkoutData {
  if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) return defaultData();
  return {
    version: raw.version || 1,
    categories: Array.isArray(raw.categories) && raw.categories.length ? raw.categories : defaultData().categories,
    exercises: Array.isArray(raw.exercises) ? raw.exercises : [],
    plans: Array.isArray(raw.plans) ? raw.plans : [],
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    weekSchedule: raw.weekSchedule && typeof raw.weekSchedule === 'object' ? { ...emptyWeekSchedule(), ...raw.weekSchedule } : emptyWeekSchedule(),
  };
}
