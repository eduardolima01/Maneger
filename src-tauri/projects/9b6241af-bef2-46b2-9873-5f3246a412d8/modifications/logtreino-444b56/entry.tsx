// ============================================================
// ARQUIVO GERADO AUTOMATICAMENTE por build.js — NÃO EDITE AQUI.
// Edite os arquivos em src/ e rode `node build.js` de novo.
// ============================================================

// ---- src/tipos/workout.types.ts ----
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
  repRangeMin?: number | null; // faixa de repetições da progressão dupla (ex: 6)
  repRangeMax?: number | null; // (ex: 8)
  weightIncrement?: number | null; // quanto subir de carga ao bater o topo da faixa (ex: 2.5)
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

interface ProgressionSuggestion {
  hasHistory: boolean;
  lastWeight: number | null;
  lastDate: string | null;
  suggestedWeight: number | null;
  suggestedRepsTarget: number | null;
  readyToIncreaseWeight: boolean;
  message: string;
}

// ---- src/servicos/format.service.ts ----
// servicos/format.service.ts
// Funções puras de formatação. Sem dependência de React ou do modApi.

function uid(prefix: string): string {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString('pt-BR');
}

function fmtMin(min: number | null | undefined): string {
  if (min == null) return '-';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? h + 'h ' + m + 'min' : m + 'min';
}

// Tempo de espera após a última alteração antes de gravar sozinho o treino do dia.
const AUTOSAVE_DELAY_MS = 600;

// ---- src/servicos/stats.service.ts ----
// servicos/stats.service.ts
// Cálculos de evolução/estatísticas. Funções puras que recebem os dados
// já carregados e devolvem números/listas prontos para a UI (ou, no
// futuro, para uma lib de gráficos).

function sessionVolume(session: FinishedSession): number {
  let vol = 0;
  (session.entries || []).forEach((e) => {
    (e.sets || []).forEach((st) => {
      vol += (Number(st.reps) || 0) * (Number(st.weight) || 0);
    });
  });
  return vol;
}

function calcStreak(sessions: FinishedSession[]): number {
  const dates = new Set(sessions.map((sn) => sn.date));
  let streak = 0;
  const cur = new Date();
  for (let i = 0; i < 3650; i++) {
    const key = cur.toISOString().slice(0, 10);
    if (dates.has(key)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else if (key === todayStr()) {
      // hoje ainda não treinou, mas não quebra a sequência de ontem pra trás
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function weeklyVolume(sessions: FinishedSession[]): number {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return sessions
    .filter((sn) => new Date(sn.date + 'T00:00:00').getTime() >= weekAgo)
    .reduce((sum, sn) => sum + sessionVolume(sn), 0);
}

function mostExecuted(sessions: FinishedSession[], limit: number): [string, number][] {
  const count: Record<string, number> = {};
  sessions.forEach((sn) => {
    (sn.entries || []).forEach((e) => {
      count[e.exerciseId] = (count[e.exerciseId] || 0) + 1;
    });
  });
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit || 5) as [string, number][];
}

function exerciseHistory(sessions: FinishedSession[], exerciseId: string): ExerciseHistoryRow[] {
  const rows: ExerciseHistoryRow[] = [];
  sessions.forEach((sn) => {
    (sn.entries || []).forEach((e) => {
      if (e.exerciseId === exerciseId) {
        (e.sets || []).forEach((st) => {
          rows.push({ date: sn.date, reps: st.reps, weight: st.weight, restSec: st.restSec, notes: st.notes });
        });
      }
    });
  });
  return rows.sort((a, b) => (new Date(b.date) as any) - (new Date(a.date) as any));
}

function personalRecord(sessions: FinishedSession[], exerciseId: string): ExerciseHistoryRow | null {
  const rows = exerciseHistory(sessions, exerciseId);
  let best: ExerciseHistoryRow | null = null;
  rows.forEach((r) => {
    const w = Number(r.weight) || 0;
    if (!best || w > (Number(best.weight) || 0)) best = r;
  });
  return best;
}

// Agrupa o histórico (que vem como uma linha por série) em uma linha por
// data — cada grupo representa "o que foi feito naquele dia", pronto pra
// exibir e para copiar de volta num treino novo.
function groupExerciseHistoryByDate(rows: ExerciseHistoryRow[]): { date: string; sets: ExerciseHistoryRow[] }[] {
  const map: Record<string, ExerciseHistoryRow[]> = {};
  rows.forEach((r) => {
    if (!map[r.date]) map[r.date] = [];
    map[r.date].push(r);
  });
  return Object.keys(map)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((date) => ({ date, sets: map[date] }));
}

// Conta quantas séries foram feitas por grupo muscular (categoria) nas
// sessões informadas. Usado pra ver o volume do dia, da semana e do mês.
function setsByCategory(sessions: FinishedSession[], exercises: Exercise[], categories: Category[]): { categoryId: string; name: string; sets: number }[] {
  const count: Record<string, number> = {};
  sessions.forEach((sn) => {
    (sn.entries || []).forEach((e) => {
      const ex = exercises.find((x) => x.id === e.exerciseId);
      const catId = ex ? ex.categoryId : 'desconhecido';
      count[catId] = (count[catId] || 0) + (e.sets ? e.sets.length : 0);
    });
  });
  return Object.keys(count)
    .map((categoryId) => {
      const cat = categories.find((c) => c.id === categoryId);
      return { categoryId, name: cat ? cat.name : 'Outros', sets: count[categoryId] };
    })
    .filter((row) => row.sets > 0)
    .sort((a, b) => b.sets - a.sets);
}

function sessionsBetween(sessions: FinishedSession[], fromIso: string, toIso: string): FinishedSession[] {
  return sessions.filter((s) => s.date >= fromIso && s.date <= toIso);
}

// ---- src/servicos/week.service.ts ----
// servicos/week.service.ts
// Tudo relacionado a "semana": chaves de dia, rótulos em pt-BR, cálculo do
// dia da semana de uma data e agrupamento do histórico em semanas
// (segunda a domingo) para o Histórico e para comparativos futuros.

const WEEKDAY_KEYS: WeekDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const WEEKDAY_LABELS: Record<WeekDayKey, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
  sun: 'Domingo',
};

function emptyWeekSchedule(): WeekSchedule {
  return { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null };
}

// JS Date.getDay(): 0=domingo ... 6=sábado. Convertemos para nossas chaves.
function weekdayKeyOf(date: Date): WeekDayKey {
  const idx = date.getDay(); // 0..6, domingo primeiro
  const map: WeekDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[idx];
}

function weekdayKeyOfIso(iso: string): WeekDayKey {
  return weekdayKeyOf(new Date(iso + 'T00:00:00'));
}

// Segunda-feira (YYYY-MM-DD) da semana que contém a data informada.
function weekStartOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0..6, domingo primeiro
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

// As 7 datas (segunda a domingo) da semana que começa em weekStartIso.
function datesOfWeek(weekStartIso: string): string[] {
  const start = new Date(weekStartIso + 'T00:00:00');
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function weekLabel(weekStartIso: string): string {
  const start = new Date(weekStartIso + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return fmt(start) + ' – ' + fmt(end);
}

// Agrupa sessões finalizadas por semana (segunda a domingo), mais recente primeiro.
function groupSessionsByWeek(sessions: FinishedSession[]): WeekGroup[] {
  const groups: Record<string, FinishedSession[]> = {};
  sessions.forEach((sn) => {
    const start = weekStartOf(new Date(sn.date + 'T00:00:00'));
    if (!groups[start]) groups[start] = [];
    groups[start].push(sn);
  });
  return Object.keys(groups)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((weekStart) => ({
      weekStart,
      label: weekLabel(weekStart),
      sessions: groups[weekStart],
      totalVolume: groups[weekStart].reduce((sum, sn) => sum + sessionVolume(sn), 0),
    }));
}

// Próximos 7 dias (incluindo hoje) com a ficha agendada para cada um, se houver.
function upcomingSchedule(weekSchedule: WeekSchedule, plans: Plan[]) {
  const result: { date: string; dayKey: WeekDayKey; dayLabel: string; plan: Plan | null; isToday: boolean }[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayKey = weekdayKeyOf(d);
    const planId = weekSchedule[dayKey];
    const plan = planId ? plans.find((p) => p.id === planId) || null : null;
    result.push({
      date: d.toISOString().slice(0, 10),
      dayKey,
      dayLabel: WEEKDAY_LABELS[dayKey],
      plan,
      isToday: i === 0,
    });
  }
  return result;
}

// ---- src/servicos/image.service.ts ----
// servicos/image.service.ts
// Lógica pura ligada a imagens — sem tocar em canvas, Image() ou DOM,
// então é testável fora do navegador.

// Procura o primeiro item de imagem numa DataTransferItemList (evento de
// paste) e devolve o Blob correspondente, ou null se não achar nenhuma
// imagem colada.
function findImageInClipboard(items: any): Blob | null {
  if (!items || typeof items.length !== 'number') return null;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && item.type && item.type.indexOf('image/') === 0 && typeof item.getAsFile === 'function') {
      const blob = item.getAsFile();
      if (blob) return blob;
    }
  }
  return null;
}

// Calcula as dimensões finais respeitando um lado máximo, sem distorcer.
function fitWithinSquare(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// ---- src/servicos/calendar.service.ts ----
// servicos/calendar.service.ts
// Lógica pura de calendário: montar a grade do mês e localizar treinos
// registrados numa data. Sem nenhum acesso a DOM/canvas — só datas.

const WEEKDAY_HEADER_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoDate(year: number, month: number, day: number): string {
  return year + '-' + pad2(month + 1) + '-' + pad2(day);
}

// Matriz de semanas (7 posições cada); null = célula fora do mês exibido.
function buildMonthGrid(year: number, month: number): (string | null)[][] {
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=domingo
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(isoDate(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function monthLabel(year: number, month: number): string {
  const d = new Date(year, month, 1);
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthRange(year: number, month: number): { from: string; to: string } {
  const from = isoDate(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = isoDate(year, month, lastDay);
  return { from, to };
}

function sessionsOnDate(sessions: FinishedSession[], dateIso: string): FinishedSession[] {
  return sessions.filter((s) => s.date === dateIso);
}

// Quebra o mês em semanas completas (segunda a domingo) — as pontas podem
// incluir dias do mês anterior/seguinte, como em qualquer calendário.
function buildMonthWeeks(year: number, month: number): string[][] {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  let cursorWeekStart = weekStartOf(firstOfMonth);
  const weeks: string[][] = [];
  for (let i = 0; i < 10; i++) {
    const days = datesOfWeek(cursorWeekStart);
    weeks.push(days);
    const lastDayOfWeek = new Date(days[6] + 'T00:00:00');
    if (lastDayOfWeek >= lastOfMonth) break;
    const next = new Date(cursorWeekStart + 'T00:00:00');
    next.setDate(next.getDate() + 7);
    cursorWeekStart = next.toISOString().slice(0, 10);
  }
  return weeks;
}

// ---- src/servicos/progression.service.ts ----
// servicos/progression.service.ts
// Método de progressão dupla (Andy Morgan / Eric Helms): primeiro sobe as
// repetições dentro de uma faixa (ex: 6 a 8); só quando TODAS as séries
// baterem o topo da faixa é que a carga sobe, voltando pro início da
// faixa de reps. Lógica pura — só olha o histórico já salvo, sem
// depender de UI.

const DEFAULT_REP_MIN = 6;
const DEFAULT_REP_MAX = 9;
const DEFAULT_WEIGHT_INCREMENT = 2.5;

function exerciseProgressionConfig(ex: Exercise): { repMin: number; repMax: number; increment: number } {
  return {
    repMin: ex.repRangeMin || DEFAULT_REP_MIN,
    repMax: ex.repRangeMax || DEFAULT_REP_MAX,
    increment: ex.weightIncrement || DEFAULT_WEIGHT_INCREMENT,
  };
}

function suggestProgression(sessions: FinishedSession[], exerciseId: string, repMin: number, repMax: number, increment: number): ProgressionSuggestion {
  const groups = groupExerciseHistoryByDate(exerciseHistory(sessions, exerciseId));

  if (groups.length === 0) {
    return {
      hasHistory: false,
      lastWeight: null,
      lastDate: null,
      suggestedWeight: null,
      suggestedRepsTarget: repMin,
      readyToIncreaseWeight: false,
      message: 'Sem histórico ainda. Comece com uma carga em que você consiga pelo menos ' + repMin + ' repetições em todas as séries.',
    };
  }

  const last = groups[0]; // mais recente primeiro
  const reps = last.sets.map((st) => Number(st.reps) || 0);
  const weights = last.sets.map((st) => Number(st.weight) || 0);
  const lastWeight = weights.length ? Math.max(...weights) : 0;
  const allSetsHitMax = reps.length > 0 && reps.every((r) => r >= repMax);

  if (allSetsHitMax) {
    const suggestedWeight = Math.round((lastWeight + increment) * 100) / 100;
    return {
      hasHistory: true,
      lastWeight,
      lastDate: last.date,
      suggestedWeight,
      suggestedRepsTarget: repMin,
      readyToIncreaseWeight: true,
      message: 'Você bateu ' + repMax + ' repetições em todas as séries — hora de subir a carga! Tente ' + suggestedWeight + 'kg buscando ' + repMin + ' repetições.',
    };
  }

  // "elo fraco": a pior série da última vez define a meta seguinte.
  const worstReps = reps.length ? Math.min(...reps) : repMin;
  const suggestedRepsTarget = Math.min(repMax, worstReps + 1);
  return {
    hasHistory: true,
    lastWeight,
    lastDate: last.date,
    suggestedWeight: lastWeight,
    suggestedRepsTarget,
    readyToIncreaseWeight: false,
    message: 'Continue com ' + lastWeight + 'kg buscando ' + suggestedRepsTarget + ' repetições em todas as séries (faixa ' + repMin + '–' + repMax + ').',
  };
}

// ---- src/servicos/data.service.ts ----
// servicos/data.service.ts
// Formato inicial dos dados e normalização defensiva (garante que campos
// nunca fiquem undefined mesmo se o data.json for editado manualmente
// ou vier de uma versão mais antiga da Modificação).

function defaultCategoryNames(): string[] {
  return [
    'Peito',
    'Costas',
    'Ombros',
    'Bíceps',
    'Tríceps',
    'Pernas',
    'Quadríceps',
    'Posterior de Coxa',
    'Panturrilha',
    'Abdômen',
    'Cardio',
    'Alongamento',
    'Outros',
  ];
}

// Garante que categorias novas do padrão (ex: adicionadas numa atualização
// da Modificação) apareçam também pra quem já tinha dados salvos — sem
// duplicar nem mexer em categorias que o usuário já tem ou criou.
function ensureDefaultCategories(categories: Category[]): Category[] {
  const existingNames = categories.map((c) => (c.name || '').trim().toLowerCase());
  const missing = defaultCategoryNames().filter((name) => !existingNames.includes(name.toLowerCase()));
  const added: Category[] = missing.map((name) => ({ id: uid('cat'), name, custom: false }));
  return [...categories, ...added];
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
    categories: Array.isArray(raw.categories) && raw.categories.length ? ensureDefaultCategories(raw.categories) : defaultData().categories,
    exercises: Array.isArray(raw.exercises) ? raw.exercises : [],
    plans: Array.isArray(raw.plans) ? raw.plans : [],
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    weekSchedule: raw.weekSchedule && typeof raw.weekSchedule === 'object' ? { ...emptyWeekSchedule(), ...raw.weekSchedule } : emptyWeekSchedule(),
  };
}

// ---- src/stores/workout.store.ts ----
// stores/workout.store.ts
// Cada função recebe o WorkoutData atual + argumentos e devolve um NOVO
// objeto WorkoutData (sem mutar o original). Nenhuma dessas funções toca
// em React ou em modApi — é lógica de domínio pura, testável fora do app.
// O hook em hooks/useWorkoutStore.ts é quem conecta isso ao React e à
// persistência.

function addCategoryToData(data: WorkoutData, name: string): WorkoutData {
  const clean = (name || '').trim();
  if (!clean) return data;
  const cat: Category = { id: uid('cat'), name: clean, custom: true };
  return { ...data, categories: [...data.categories, cat] };
}

function addExerciseToData(data: WorkoutData, name: string, categoryId: string): WorkoutData {
  const clean = (name || '').trim();
  if (!clean || !categoryId) return data;
  const ex: Exercise = { id: uid('ex'), name: clean, categoryId, notes: '' };
  return { ...data, exercises: [...data.exercises, ex] };
}

// Cria um exercício com id definido por quem chama (assim a tela já consegue
// referenciar o exercício novo antes da próxima renderização).
function createExerciseInData(data: WorkoutData, id: string, name: string, categoryId: string, photo: string | null): WorkoutData {
  const clean = (name || '').trim();
  if (!clean || !categoryId) return data;
  const ex: Exercise = { id, name: clean, categoryId, notes: '', photo: photo || null };
  return { ...data, exercises: [...data.exercises, ex] };
}

// Edita nome, grupo muscular e capa. Ao renomear, atualiza também o nome
// gravado dentro dos treinos já registrados (eles guardam uma cópia do nome).
function updateExerciseInData(data: WorkoutData, id: string, name: string, categoryId: string, photo: string | null): WorkoutData {
  const clean = (name || '').trim();
  if (!clean || !categoryId) return data;
  return {
    ...data,
    exercises: data.exercises.map((e) => (e.id === id ? { ...e, name: clean, categoryId, photo: photo || null } : e)),
    sessions: data.sessions.map((sn) => ({
      ...sn,
      entries: sn.entries.map((en) => (en.exerciseId === id ? { ...en, exerciseName: clean } : en)),
    })),
  };
}

function deleteExerciseFromData(data: WorkoutData, id: string): WorkoutData {
  return { ...data, exercises: data.exercises.filter((e) => e.id !== id) };
}

function setExercisePhotoInData(data: WorkoutData, exerciseId: string, photo: string | null): WorkoutData {
  return {
    ...data,
    exercises: data.exercises.map((e) => (e.id === exerciseId ? { ...e, photo } : e)),
  };
}

function updateExerciseProgressionConfigInData(data: WorkoutData, exerciseId: string, repMin: number, repMax: number, increment: number): WorkoutData {
  return {
    ...data,
    exercises: data.exercises.map((e) =>
      e.id === exerciseId ? { ...e, repRangeMin: repMin, repRangeMax: repMax, weightIncrement: increment } : e
    ),
  };
}

function createPlanInData(data: WorkoutData, name: string, exerciseIds: string[]): WorkoutData {
  const clean = (name || '').trim();
  if (!clean || !exerciseIds || exerciseIds.length === 0) return data;
  const plan: Plan = { id: uid('plan'), name: clean, exerciseIds };
  return { ...data, plans: [...data.plans, plan] };
}

function deletePlanFromData(data: WorkoutData, id: string): WorkoutData {
  return { ...data, plans: data.plans.filter((p) => p.id !== id) };
}

function updatePlanExercisesInData(data: WorkoutData, planId: string, exerciseIds: string[]): WorkoutData {
  return {
    ...data,
    plans: data.plans.map((p) => (p.id === planId ? { ...p, exerciseIds } : p)),
  };
}

function addExerciseAndAttachToPlanInData(data: WorkoutData, planId: string, exerciseId: string, name: string, categoryId: string): WorkoutData {
  const clean = (name || '').trim();
  if (!clean || !categoryId) return data;
  const ex: Exercise = { id: exerciseId, name: clean, categoryId, notes: '' };
  const plans = data.plans.map((p) => (p.id === planId ? { ...p, exerciseIds: [...p.exerciseIds, ex.id] } : p));
  return { ...data, exercises: [...data.exercises, ex], plans };
}

function setWeekScheduleDayInData(data: WorkoutData, dayKey: WeekDayKey, planId: string | null): WorkoutData {
  return { ...data, weekSchedule: { ...data.weekSchedule, [dayKey]: planId } };
}

// Monta os "entries" iniciais de um treino a partir dos exercícios de uma
// ficha (sem séries ainda — o usuário lança na hora de registrar).
function entriesFromPlan(plan: Plan | null, exercises: Exercise[]): SessionEntry[] {
  if (!plan) return [];
  return (plan.exerciseIds
    .map((id) => exercises.find((e) => e.id === id))
    .filter(Boolean) as Exercise[])
    .map((ex) => ({ exerciseId: ex.id, exerciseName: ex.name, completed: false, sets: [] }));
}

// Clona os exercícios e séries de um treino já registrado (mesmos valores,
// ids novos) — usado pra "copiar o treino passado" inteiro pra um dia novo.
function copyEntriesFromSession(sourceEntries: SessionEntry[]): SessionEntry[] {
  return sourceEntries.map((e) => ({
    exerciseId: e.exerciseId,
    exerciseName: e.exerciseName,
    completed: false,
    sets: e.sets.map((st) => ({ ...st, id: uid('set'), completed: false })),
  }));
}

function createSessionInData(data: WorkoutData, date: string, planId: string | null, entries: SessionEntry[], durationMin: number): WorkoutData {
  const plan = planId ? data.plans.find((p) => p.id === planId) : null;
  const session: FinishedSession = {
    id: uid('sess'),
    planId: plan ? plan.id : null,
    planName: plan ? plan.name : 'Treino livre',
    date,
    entries,
    notes: '',
    durationMin: durationMin || 0,
    endedAt: Date.now(),
  };
  return { ...data, sessions: [session, ...data.sessions] };
}

function updateSessionInData(data: WorkoutData, sessionId: string, planId: string | null, entries: SessionEntry[], durationMin: number): WorkoutData {
  const plan = planId ? data.plans.find((p) => p.id === planId) : null;
  return {
    ...data,
    sessions: data.sessions.map((s) =>
      s.id === sessionId
        ? { ...s, planId: plan ? plan.id : null, planName: plan ? plan.name : 'Treino livre', entries, durationMin: durationMin || 0 }
        : s
    ),
  };
}

function deleteSessionInData(data: WorkoutData, sessionId: string): WorkoutData {
  return { ...data, sessions: data.sessions.filter((s) => s.id !== sessionId) };
}

function moveSessionEntryInData(data: WorkoutData, sessionId: string, exerciseId: string, direction: 'up' | 'down'): WorkoutData {
  return {
    ...data,
    sessions: data.sessions.map((s) => {
      if (s.id !== sessionId) return s;
      const idx = s.entries.findIndex((e) => e.exerciseId === exerciseId);
      if (idx === -1) return s;
      const swapWith = direction === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= s.entries.length) return s;
      const entries = [...s.entries];
      const tmp = entries[idx];
      entries[idx] = entries[swapWith];
      entries[swapWith] = tmp;
      return { ...s, entries };
    }),
  };
}

// Editar séries de um exercício dentro de uma sessão já salva, sem passar
// pelo formulário do dia inteiro (usado nos atalhos rápidos da Home).
function addSetToSessionInData(data: WorkoutData, sessionId: string, exerciseId: string): WorkoutData {
  return {
    ...data,
    sessions: data.sessions.map((s) => {
      if (s.id !== sessionId) return s;
      const entries = s.entries.map((e) => {
        if (e.exerciseId !== exerciseId) return e;
        const last = e.sets[e.sets.length - 1];
        const set: WorkoutSet = {
          id: uid('set'),
          reps: last ? last.reps : '',
          weight: last ? last.weight : '',
          restSec: last ? last.restSec : 60,
          notes: '',
          completed: false,
        };
        return { ...e, sets: [...e.sets, set] };
      });
      return { ...s, entries };
    }),
  };
}

function updateSetInSessionData(data: WorkoutData, sessionId: string, exerciseId: string, setId: string, field: string, value: any): WorkoutData {
  return {
    ...data,
    sessions: data.sessions.map((s) => {
      if (s.id !== sessionId) return s;
      const entries = s.entries.map((e) => {
        if (e.exerciseId !== exerciseId) return e;
        return { ...e, sets: e.sets.map((st) => (st.id === setId ? { ...st, [field]: value } : st)) };
      });
      return { ...s, entries };
    }),
  };
}

function removeSetFromSessionData(data: WorkoutData, sessionId: string, exerciseId: string, setId: string): WorkoutData {
  return {
    ...data,
    sessions: data.sessions.map((s) => {
      if (s.id !== sessionId) return s;
      const entries = s.entries.map((e) => (e.exerciseId === exerciseId ? { ...e, sets: e.sets.filter((st) => st.id !== setId) } : e));
      return { ...s, entries };
    }),
  };
}

function duplicateSetInSessionData(data: WorkoutData, sessionId: string, exerciseId: string, setId: string): WorkoutData {
  return {
    ...data,
    sessions: data.sessions.map((s) => {
      if (s.id !== sessionId) return s;
      const entries = s.entries.map((e) => {
        if (e.exerciseId !== exerciseId) return e;
        const original = e.sets.find((st) => st.id === setId);
        if (!original) return e;
        return { ...e, sets: [...e.sets, { ...original, id: uid('set') }] };
      });
      return { ...s, entries };
    }),
  };
}

// Garante que existe uma sessão (treino) na data — reaproveita se já
// existir, cria "Treino livre" se não existir — e adiciona um exercício
// avulso a ela, sem séries ainda (lançadas depois no dia completo).
function quickAddExerciseInData(data: WorkoutData, date: string, exerciseId: string): WorkoutData {
  const ex = data.exercises.find((e) => e.id === exerciseId);
  if (!ex) return data;
  const existing = data.sessions.find((s) => s.date === date);
  if (existing) {
    if (existing.entries.some((e) => e.exerciseId === exerciseId)) return data;
    const entries = [...existing.entries, { exerciseId: ex.id, exerciseName: ex.name, completed: false, sets: [] }];
    return { ...data, sessions: data.sessions.map((s) => (s.id === existing.id ? { ...s, entries } : s)) };
  }
  const session: FinishedSession = {
    id: uid('sess'),
    planId: null,
    planName: 'Treino livre',
    date,
    entries: [{ exerciseId: ex.id, exerciseName: ex.name, completed: false, sets: [] }],
    notes: '',
    durationMin: 0,
    endedAt: Date.now(),
  };
  return { ...data, sessions: [session, ...data.sessions] };
}

// Mesma ideia, mas importa todos os exercícios de uma ficha de uma vez
// (mesclando com o que já existir na sessão daquele dia, sem duplicar).
function importPlanToDateInData(data: WorkoutData, date: string, planId: string): WorkoutData {
  const plan = data.plans.find((p) => p.id === planId);
  if (!plan) return data;
  const planEntries = entriesFromPlan(plan, data.exercises);
  const existing = data.sessions.find((s) => s.date === date);
  if (existing) {
    const existingIds = existing.entries.map((e) => e.exerciseId);
    const merged = [...existing.entries, ...planEntries.filter((e) => !existingIds.includes(e.exerciseId))];
    return {
      ...data,
      sessions: data.sessions.map((s) => (s.id === existing.id ? { ...s, planId: plan.id, planName: plan.name, entries: merged } : s)),
    };
  }
  const session: FinishedSession = {
    id: uid('sess'),
    planId: plan.id,
    planName: plan.name,
    date,
    entries: planEntries,
    notes: '',
    durationMin: 0,
    endedAt: Date.now(),
  };
  return { ...data, sessions: [session, ...data.sessions] };
}

// ---- src/hooks/useWorkoutStore.ts ----
// hooks/useWorkoutStore.ts
// Único ponto de contato com modApi.storage. Conecta as funções puras de
// stores/workout.store.ts ao ciclo de vida do React (useState/useEffect).
//
// "React" não pode ser importado (não existe import no runtime), então é
// recebido como parâmetro, igual ao componente principal recebe.

function useWorkoutStore(modApi: ModApi, React: any) {
  const [data, setData] = React.useState<WorkoutData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    modApi.storage.get().then((raw: any) => {
      if (!alive) return;
      const hasData = raw && Object.keys(raw).length > 0;
      const initial = normalizeData(raw);
      setData(initial);
      setLoading(false);
      if (!hasData) modApi.storage.set(initial);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function persist(next: WorkoutData) {
    setData(next);
    await modApi.storage.set(next);
  }

  // Cada ação abaixo = uma função pura do store + persistência.
  // Mantém o componente principal livre de lógica de negócio.
  const actions = {
    addCategory: (name: string) => data && persist(addCategoryToData(data, name)),
    addExercise: (name: string, categoryId: string) => data && persist(addExerciseToData(data, name, categoryId)),
    createExercise: (id: string, name: string, categoryId: string, photo: string | null) =>
      data && persist(createExerciseInData(data, id, name, categoryId, photo)),
    updateExercise: (id: string, name: string, categoryId: string, photo: string | null) =>
      data && persist(updateExerciseInData(data, id, name, categoryId, photo)),
    deleteExercise: (id: string) => data && persist(deleteExerciseFromData(data, id)),
    setExercisePhoto: (exerciseId: string, photo: string | null) => data && persist(setExercisePhotoInData(data, exerciseId, photo)),
    updateExerciseProgression: (exerciseId: string, repMin: number, repMax: number, increment: number) =>
      data && persist(updateExerciseProgressionConfigInData(data, exerciseId, repMin, repMax, increment)),
    createPlan: (name: string, exerciseIds: string[]) => data && persist(createPlanInData(data, name, exerciseIds)),
    deletePlan: (id: string) => data && persist(deletePlanFromData(data, id)),
    updatePlanExercises: (planId: string, exerciseIds: string[]) => data && persist(updatePlanExercisesInData(data, planId, exerciseIds)),
    addExerciseToPlan: (planId: string, exerciseId: string, name: string, categoryId: string) =>
      data && persist(addExerciseAndAttachToPlanInData(data, planId, exerciseId, name, categoryId)),
    setWeekScheduleDay: (dayKey: WeekDayKey, planId: string | null) => data && persist(setWeekScheduleDayInData(data, dayKey, planId)),
    createSession: (date: string, planId: string | null, entries: SessionEntry[], durationMin: number) =>
      data && persist(createSessionInData(data, date, planId, entries, durationMin)),
    updateSession: (sessionId: string, planId: string | null, entries: SessionEntry[], durationMin: number) =>
      data && persist(updateSessionInData(data, sessionId, planId, entries, durationMin)),
    deleteSession: (sessionId: string) => data && persist(deleteSessionInData(data, sessionId)),
    moveSessionEntry: (sessionId: string, exerciseId: string, direction: 'up' | 'down') =>
      data && persist(moveSessionEntryInData(data, sessionId, exerciseId, direction)),
    addSetToSession: (sessionId: string, exerciseId: string) => data && persist(addSetToSessionInData(data, sessionId, exerciseId)),
    updateSetInSession: (sessionId: string, exerciseId: string, setId: string, field: string, value: any) =>
      data && persist(updateSetInSessionData(data, sessionId, exerciseId, setId, field, value)),
    removeSetFromSession: (sessionId: string, exerciseId: string, setId: string) =>
      data && persist(removeSetFromSessionData(data, sessionId, exerciseId, setId)),
    duplicateSetInSession: (sessionId: string, exerciseId: string, setId: string) =>
      data && persist(duplicateSetInSessionData(data, sessionId, exerciseId, setId)),
    quickAddExercise: (date: string, exerciseId: string) => data && persist(quickAddExerciseInData(data, date, exerciseId)),
    importPlanToDate: (date: string, planId: string) => data && persist(importPlanToDateInData(data, date, planId)),
  };

  return { data, loading, actions };
}

// ---- src/componentes/theme.ts ----
// componentes/theme.ts
// Tokens de cor e estilos inline reutilizados por toda a Modificação.
// Sem CSS externo/Tailwind — o runtime não garante nenhuma classe disponível.

const colors = {
  bg: '#0f1115',
  card: '#181b21',
  cardAlt: '#1f232b',
  border: '#2a2f3a',
  text: '#e8eaed',
  textDim: '#9aa1ac',
  accent: '#5b8cff',
  accentDim: '#2a3a66',
  green: '#4ade80',
  red: '#f87171',
  amber: '#fbbf24',
};

function buildStyles() {
  return {
    root: { color: colors.text, background: colors.bg, minHeight: '100%', padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
    h1: { margin: '0 0 4px', fontSize: 20, fontWeight: 700 },
    h2: { margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: colors.text },
    small: { fontSize: 12, color: colors.textDim },
    tabBar: { display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
    tabBtn: (active: boolean) => ({
      padding: '8px 12px', borderRadius: 8, border: '1px solid ' + (active ? colors.accent : colors.border),
      background: active ? colors.accentDim : colors.card, color: active ? '#cfe0ff' : colors.textDim,
      cursor: 'pointer', fontSize: 13, fontWeight: 600,
    }),
    card: { background: colors.card, border: '1px solid ' + colors.border, borderRadius: 12, padding: 14, marginBottom: 12 },
    cardAlt: { background: colors.cardAlt, border: '1px solid ' + colors.border, borderRadius: 10, padding: 10, marginBottom: 8 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 },
    statNum: { fontSize: 22, fontWeight: 700, color: colors.text },
    statLabel: { fontSize: 12, color: colors.textDim, marginTop: 2 },
    input: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid ' + colors.border, background: '#11141a', color: colors.text, fontSize: 13, marginBottom: 8 },
    label: { fontSize: 12, color: colors.textDim, marginBottom: 4, display: 'block' },
    btn: { padding: '8px 14px', borderRadius: 8, border: 'none', background: colors.accent, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
    btnGhost: { padding: '8px 14px', borderRadius: 8, border: '1px solid ' + colors.border, background: 'transparent', color: colors.text, fontSize: 13, cursor: 'pointer' },
    btnDanger: { padding: '6px 10px', borderRadius: 8, border: '1px solid ' + colors.red, background: 'transparent', color: colors.red, fontSize: 12, cursor: 'pointer' },
    btnSmall: { padding: '5px 9px', borderRadius: 7, border: '1px solid ' + colors.border, background: colors.cardAlt, color: colors.text, fontSize: 12, cursor: 'pointer' },
    row: { display: 'flex', gap: 8, alignItems: 'center' },
    badge: { fontSize: 11, padding: '2px 8px', borderRadius: 999, background: colors.accentDim, color: '#cfe0ff', display: 'inline-block' },
    setRow: { display: 'grid', gridTemplateColumns: '22px 1fr 1fr 1fr 30px 26px', gap: 6, alignItems: 'center', marginBottom: 6 },
    link: { color: colors.accent, cursor: 'pointer', textDecoration: 'none', fontWeight: 600 },
    colors,
  };
}

// ---- src/componentes/Tabs.tsx ----
// componentes/Tabs.tsx
// "React" continua vindo via props (não existe import no runtime) — o
// transform de JSX do sucrase gera chamadas a React.createElement, então
// o identificador "React" precisa estar no escopo de cada arquivo com JSX.
function Tabs({ React, s, tabs, active, onChange }: any) {
  return (
    <div style={s.tabBar}>
      {tabs.map((t: any) => (
        <button key={t.key} style={s.tabBtn(active === t.key)} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---- src/componentes/StatCard.tsx ----
// componentes/StatCard.tsx
function StatCard({ React, s, value, label }: any) {
  return (
    <div style={s.card}>
      <div style={s.statNum}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

// ---- src/componentes/SearchInput.tsx ----
// componentes/SearchInput.tsx
function SearchInput({ React, s, value, onChange, placeholder }: any) {
  return (
    <input
      style={s.input}
      placeholder={placeholder || '🔎 Buscar...'}
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
    />
  );
}

// ---- src/componentes/ExercisePhotoField.tsx ----
// componentes/ExercisePhotoField.tsx
// Upload/colagem de foto sem "document": <input type="file"> normal para
// escolher do disco, onPaste (Ctrl+V) na própria miniatura para colar uma
// imagem copiada, e um <canvas> montado pelo React (via ref) para
// redimensionar e comprimir antes de salvar — o data.json é só texto.
function ExercisePhotoField({ React, s, exercise, onSetPhoto, size, readOnly }: any) {
  const canvasRef = React.useRef(null);
  const [busy, setBusy] = React.useState(false);
  const dim = size || 48;

  function processBlob(blob: Blob) {
    setBusy(true);
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const { width: w, height: h } = fitWithinSquare(img.width, img.height, 480);
      const canvas = canvasRef.current;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
      onSetPhoto(exercise.id, dataUrl);
      URL.revokeObjectURL(objectUrl);
      setBusy(false);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setBusy(false);
    };
    img.src = objectUrl;
  }

  function handleFile(e: any) {
    const file = e.target.files && e.target.files[0];
    if (file) processBlob(file);
  }

  function handlePaste(e: any) {
    const blob = findImageInClipboard(e.clipboardData && e.clipboardData.items);
    if (blob) {
      e.preventDefault();
      processBlob(blob);
    }
  }

  const thumb = exercise.photo ? (
    <img src={exercise.photo} alt={exercise.name} style={{ width: dim, height: dim, objectFit: 'cover', display: 'block', borderRadius: 8 }} />
  ) : (
    <div
      style={{
        width: dim,
        height: dim,
        background: s.colors.cardAlt,
        border: '1px dashed ' + s.colors.border,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        color: s.colors.textDim,
        textAlign: 'center',
        padding: 2,
      }}
    >
      {readOnly ? 'sem foto' : 'clique + Ctrl+V'}
    </div>
  );

  if (readOnly) {
    return <div style={{ width: dim, height: dim, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>{thumb}</div>;
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div style={s.row}>
        <div tabIndex={0} onPaste={handlePaste} title="Clique aqui e cole (Ctrl+V) uma imagem copiada" style={{ outline: 'none', cursor: 'text' }}>
          {thumb}
        </div>
        <label style={{ ...s.btnSmall, cursor: 'pointer' }}>
          {busy ? 'Processando...' : exercise.photo ? 'Trocar foto' : '+ Foto'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </label>
        {exercise.photo && <button style={s.btnDanger} onClick={() => onSetPhoto(exercise.id, null)}>remover foto</button>}
      </div>
      <div style={{ ...s.small, marginTop: 4 }}>Clique na miniatura e aperte Ctrl+V para colar uma imagem copiada.</div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

// ---- src/componentes/ExerciseListItem.tsx ----
// componentes/ExerciseListItem.tsx
function ExerciseListItem({ React, s, exercise, onOpen, onDelete, onSetPhoto }: any) {
  return (
    <div style={s.cardAlt}>
      <div style={{ ...s.row, justifyContent: 'space-between' }}>
        <span style={s.link} onClick={() => onOpen(exercise.id)}>{exercise.name}</span>
        <button style={s.btnDanger} onClick={() => onDelete(exercise.id)}>remover</button>
      </div>
      <ExercisePhotoField React={React} s={s} exercise={exercise} onSetPhoto={onSetPhoto} size={40} />
    </div>
  );
}

// ---- src/componentes/PlanCard.tsx ----
// componentes/PlanCard.tsx
function PlanCard({ React, s, plan, exercises, categories, onDelete, onUpdate, onCreateExercise }: any) {
  const [editing, setEditing] = React.useState(false);
  const [editedIds, setEditedIds] = React.useState<string[]>(plan.exerciseIds);
  const [newExName, setNewExName] = React.useState('');
  const [newExCat, setNewExCat] = React.useState(categories[0] ? categories[0].id : '');

  function toggleId(exId: string) {
    setEditedIds((prev: string[]) => (prev.includes(exId) ? prev.filter((x) => x !== exId) : [...prev, exId]));
  }

  function startEditing() {
    setEditedIds(plan.exerciseIds);
    setEditing(true);
  }

  function save() {
    onUpdate(plan.id, editedIds);
    setEditing(false);
  }

  function createAndAdd() {
    const name = newExName.trim();
    if (!name || !newExCat) return;
    const newId = uid('ex');
    onCreateExercise(plan.id, newId, name, newExCat);
    setEditedIds((prev: string[]) => [...prev, newId]);
    setNewExName('');
  }

  const names = plan.exerciseIds
    .map((id: string) => {
      const ex = exercises.find((e: any) => e.id === id);
      return ex ? ex.name : null;
    })
    .filter(Boolean)
    .join(' · ');

  if (editing) {
    return (
      <div style={s.card}>
        <div style={{ ...s.row, justifyContent: 'space-between' }}>
          <div style={s.h2}>{plan.name}</div>
        </div>

        <div style={s.label}>Exercícios da ficha:</div>
        <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 10 }}>
          {exercises.length === 0 ? (
            <div style={s.small}>Nenhum exercício cadastrado ainda.</div>
          ) : (
            exercises.map((ex: any) => (
              <label key={ex.id} style={{ ...s.row, marginBottom: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={editedIds.includes(ex.id)} onChange={() => toggleId(ex.id)} />
                <span>{ex.name}</span>
              </label>
            ))
          )}
        </div>

        <div style={s.label}>Adicionar novo exercício direto na ficha:</div>
        <div style={{ ...s.row, marginBottom: 10 }}>
          <input
            style={{ ...s.input, marginBottom: 0, flex: 1 }}
            placeholder="Nome do exercício"
            value={newExName}
            onChange={(e: any) => setNewExName(e.target.value)}
          />
          <select style={{ ...s.input, marginBottom: 0, width: 140 }} value={newExCat} onChange={(e: any) => setNewExCat(e.target.value)}>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button style={s.btnGhost} onClick={createAndAdd}>+ Adicionar</button>
        </div>

        <div style={s.row}>
          <button style={s.btn} onClick={save}>Salvar</button>
          <button style={s.btnGhost} onClick={() => setEditing(false)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.card}>
      <div style={{ ...s.row, justifyContent: 'space-between' }}>
        <div style={s.h2}>{plan.name}</div>
        <div style={s.row}>
          <button style={s.btnSmall} onClick={startEditing}>editar</button>
          <button style={s.btnDanger} onClick={() => onDelete(plan.id)}>excluir</button>
        </div>
      </div>
      <div style={s.small}>{names || 'Nenhum exercício ainda.'}</div>
    </div>
  );
}

// ---- src/componentes/MuscleVolume.tsx ----
// componentes/MuscleVolume.tsx
// Mostra quantas séries foram feitas por grupo muscular, com uma barra
// proporcional ao maior valor. Reutilizado para o dia, a semana e o mês.
function MuscleVolume({ React, s, rows, title, emptyText }: any) {
  const total = rows.reduce((sum: number, r: any) => sum + r.sets, 0);
  const max = rows.length ? Math.max(...rows.map((r: any) => r.sets)) : 0;

  return (
    <div>
      {title && (
        <div style={{ ...s.row, justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{title}</span>
          <span style={s.badge}>{total} série{total === 1 ? '' : 's'}</span>
        </div>
      )}
      {rows.length === 0 ? (
        <div style={s.small}>{emptyText || 'Nenhuma série registrada.'}</div>
      ) : (
        rows.map((r: any) => (
          <div key={r.categoryId} style={{ marginBottom: 5 }}>
            <div style={{ ...s.row, justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 12 }}>{r.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{r.sets}</span>
            </div>
            <div style={{ height: 5, background: s.colors.cardAlt, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: (max ? Math.round((r.sets / max) * 100) : 0) + '%', background: s.colors.accent }} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ---- src/componentes/ExercisePicker.tsx ----
// componentes/ExercisePicker.tsx
// Busca de exercício com lista navegável: digitar filtra, ↑/↓ movem a
// seleção, Enter adiciona o destacado. Depois de adicionar, o campo é
// limpo e o foco volta pra ele, pra emendar vários exercícios seguidos.
function ExercisePicker({ React, s, exercises, categories, onPick, placeholder }: any) {
  const inputRef = React.useRef(null);
  const [query, setQuery] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [highlight, setHighlight] = React.useState(0);

  const filtered = exercises.filter((ex: any) => {
    if (categoryId && ex.categoryId !== categoryId) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return ex.name.toLowerCase().includes(q);
  });

  // Se a lista encolher com a digitação, evita o destaque ficar fora dela.
  const safeHighlight = filtered.length === 0 ? 0 : Math.min(highlight, filtered.length - 1);

  function pick(ex: any) {
    if (!ex) return;
    onPick(ex.id);
    setQuery('');
    setHighlight(0);
    if (inputRef.current) inputRef.current.focus();
  }

  function handleKeyDown(e: any) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h: number) => (filtered.length === 0 ? 0 : Math.min(h + 1, filtered.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h: number) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(filtered[safeHighlight]);
    } else if (e.key === 'Escape') {
      setQuery('');
      setHighlight(0);
    }
  }

  return (
    <div>
      {categories && categories.length > 0 && (
        <select
          style={s.input}
          value={categoryId}
          onChange={(e: any) => {
            setCategoryId(e.target.value);
            setHighlight(0);
            if (inputRef.current) inputRef.current.focus();
          }}
        >
          <option value="">Todos os grupos musculares</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
      <input
        ref={inputRef}
        style={s.input}
        placeholder={placeholder || '🔎 Buscar exercício (↑↓ navega, Enter adiciona)'}
        value={query}
        onChange={(e: any) => {
          setQuery(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={handleKeyDown}
      />
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={s.small}>Nenhum exercício encontrado.</div>
        ) : (
          filtered.map((ex: any, i: number) => (
            <div
              key={ex.id}
              onClick={() => pick(ex)}
              onMouseEnter={() => setHighlight(i)}
              style={{
                ...s.row,
                padding: 6,
                borderRadius: 8,
                cursor: 'pointer',
                marginBottom: 2,
                background: i === safeHighlight ? s.colors.accentDim : 'transparent',
                border: '1px solid ' + (i === safeHighlight ? s.colors.accent : 'transparent'),
              }}
            >
              <ExercisePhotoField React={React} s={s} exercise={ex} size={36} readOnly />
              <span style={{ fontSize: 13 }}>{ex.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---- src/componentes/ExerciseFormPanel.tsx ----
// componentes/ExerciseFormPanel.tsx
// Formulário de exercício, usado tanto para CRIAR quanto para EDITAR
// (nome, grupo muscular e capa). Quando `exercise` é null, é um exercício
// novo. A capa fica num rascunho local até clicar em Salvar, então cancelar
// não altera nada. Reaproveita o ExercisePhotoField (arquivo ou Ctrl+V).
function ExerciseFormPanel({ React, s, exercise, categories, onSave, onCancel }: any) {
  const isNew = !exercise;
  const [name, setName] = React.useState(exercise ? exercise.name : '');
  const [categoryId, setCategoryId] = React.useState(
    exercise ? exercise.categoryId : categories[0] ? categories[0].id : ''
  );
  const [photo, setPhoto] = React.useState<string | null>(exercise ? exercise.photo || null : null);

  const canSave = name.trim().length > 0 && !!categoryId;

  function save() {
    if (!canSave) return;
    onSave(name.trim(), categoryId, photo);
  }

  return (
    <div style={{ ...s.card, border: '1px solid ' + s.colors.accent }}>
      <div style={s.h2}>{isNew ? 'Novo exercício' : 'Editar exercício'}</div>

      <label style={s.label}>Nome</label>
      <input
        autoFocus
        style={s.input}
        placeholder="Nome do exercício"
        value={name}
        onChange={(e: any) => setName(e.target.value)}
        onKeyDown={(e: any) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onCancel();
        }}
      />

      <label style={s.label}>Grupo muscular</label>
      <select style={s.input} value={categoryId} onChange={(e: any) => setCategoryId(e.target.value)}>
        {categories.map((c: any) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <label style={s.label}>Capa</label>
      <ExercisePhotoField
        React={React}
        s={s}
        exercise={{ id: 'draft', name: name || 'exercício', photo }}
        onSetPhoto={(_id: string, dataUrl: string | null) => setPhoto(dataUrl)}
        size={96}
      />

      <div style={{ ...s.row, marginTop: 12 }}>
        <button style={{ ...s.btn, opacity: canSave ? 1 : 0.5 }} disabled={!canSave} onClick={save}>
          {isNew ? 'Criar e adicionar ao treino' : 'Salvar alterações'}
        </button>
        <button style={s.btnGhost} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

// ---- src/componentes/SessionEditor.tsx ----
// componentes/SessionEditor.tsx
// Formulário para registrar (ou editar) um treino já realizado numa data
// específica escolhida no Calendário. Sem cronômetro/sessão ao vivo: só
// escolhe a ficha (ou treino livre), lança as séries de cada exercício e
// salva AUTOMATICAMENTE (não existe botão de salvar). Cada exercício mostra o histórico de treinos anteriores, com
// botão pra copiar as séries de qualquer data passada.
function SessionEditor({ React, s, data, date, existingSession, onAutoSave, onClose, onDelete, onUpdatePlanOrder, onCreatePlanFromOrder, onCreateExercise, onUpdateExercise }: any) {
  const scheduledPlanId = data.weekSchedule[weekdayKeyOfIso(date)] || '';
  const initialPlanId = existingSession ? existingSession.planId || '' : scheduledPlanId;

  const [planId, setPlanId] = React.useState(initialPlanId);
  const [entries, setEntries] = React.useState<SessionEntry[]>(
    existingSession ? existingSession.entries : entriesFromPlan(data.plans.find((p: any) => p.id === initialPlanId) || null, data.exercises)
  );
  const [durationMin, setDurationMin] = React.useState(existingSession ? existingSession.durationMin : '');
  const [newPlanName, setNewPlanName] = React.useState('');
  const [showNewPlanForm, setShowNewPlanForm] = React.useState(false);
  const [openHistoryFor, setOpenHistoryFor] = React.useState<Record<string, boolean>>({});
  const [copyFromSessionId, setCopyFromSessionId] = React.useState('');
  // null = fechado | { exerciseId: null } = novo | { exerciseId: 'x' } = editando x
  const [exerciseForm, setExerciseForm] = React.useState<{ exerciseId: string | null } | null>(null);

  // ---------- salvamento automático ----------
  // Qualquer mudança em ficha, exercícios/séries ou duração é gravada sozinha
  // (com um pequeno atraso, pra não gravar a cada tecla digitada). Ao fechar
  // o formulário, o que ainda estiver pendente é gravado na hora.
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'pending' | 'saved'>('idle');
  const latestRef = React.useRef({ planId, entries, durationMin });
  latestRef.current = { planId, entries, durationMin };
  const onAutoSaveRef = React.useRef(onAutoSave);
  onAutoSaveRef.current = onAutoSave;
  const snapshotOf = (st: any) => JSON.stringify([st.planId || '', st.entries, Number(st.durationMin) || 0]);
  const lastSavedRef = React.useRef(snapshotOf(latestRef.current));

  function flushSave(silent: boolean) {
    const cur = latestRef.current;
    const snap = snapshotOf(cur);
    if (snap === lastSavedRef.current) return;
    lastSavedRef.current = snap;
    onAutoSaveRef.current(cur.planId || null, cur.entries, Number(cur.durationMin) || 0);
    if (!silent) setSaveStatus('saved');
  }

  React.useEffect(() => {
    if (snapshotOf({ planId, entries, durationMin }) === lastSavedRef.current) return;
    setSaveStatus('pending');
    const timer = setTimeout(() => flushSave(false), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [planId, entries, durationMin]);

  // ao sair da tela (fechar, trocar de aba...), grava o que ainda estiver pendente
  React.useEffect(() => {
    return () => flushSave(true);
  }, []);

  // o próprio dia aberto não conta como "treino anterior" (histórico e meta)
  const historySessions = data.sessions.filter((sn: any) => sn.date !== date);

  const selectedPlan = data.plans.find((p: any) => p.id === planId) || null;
  const orderedExerciseIds = entries.map((e: SessionEntry) => e.exerciseId);
  const dayMuscleRows = setsByCategory([{ entries } as any], data.exercises, data.categories);
  const pastSessions = data.sessions.filter((sn: any) => !existingSession || sn.id !== existingSession.id);

  function updatePlanWithTodayOrder() {
    if (!selectedPlan || orderedExerciseIds.length === 0) return;
    onUpdatePlanOrder(selectedPlan.id, orderedExerciseIds);
  }

  function createPlanFromTodayOrder() {
    const name = newPlanName.trim();
    if (!name || orderedExerciseIds.length === 0) return;
    onCreatePlanFromOrder(name, orderedExerciseIds);
    setNewPlanName('');
    setShowNewPlanForm(false);
  }

  function loadFromPlan() {
    const plan = data.plans.find((p: any) => p.id === planId) || null;
    setEntries(entriesFromPlan(plan, data.exercises));
  }

  function copyPastWorkout() {
    const source = data.sessions.find((sn: any) => sn.id === copyFromSessionId);
    if (!source) return;
    setEntries(copyEntriesFromSession(source.entries));
    setPlanId(source.planId || '');
    setCopyFromSessionId('');
  }

  function saveExerciseForm(name: string, categoryId: string, photo: string | null) {
    if (!exerciseForm) return;
    if (exerciseForm.exerciseId) {
      // editando: grava no cadastro e atualiza o nome já exibido neste treino
      const id = exerciseForm.exerciseId;
      onUpdateExercise(id, name, categoryId, photo);
      setEntries((prev: SessionEntry[]) => prev.map((e) => (e.exerciseId === id ? { ...e, exerciseName: name } : e)));
    } else {
      // novo: cria no cadastro e já coloca no final do treino do dia
      const id = uid('ex');
      onCreateExercise(id, name, categoryId, photo);
      setEntries((prev: SessionEntry[]) => [...prev, { exerciseId: id, exerciseName: name, completed: false, sets: [] }]);
    }
    setExerciseForm(null);
  }

  function removeEntry(exerciseId: string) {
    setEntries((prev: SessionEntry[]) => prev.filter((e) => e.exerciseId !== exerciseId));
  }

  function moveEntry(exerciseId: string, direction: 'up' | 'down') {
    setEntries((prev: SessionEntry[]) => {
      const idx = prev.findIndex((e) => e.exerciseId === exerciseId);
      if (idx === -1) return prev;
      const swapWith = direction === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[idx];
      next[idx] = next[swapWith];
      next[swapWith] = tmp;
      return next;
    });
  }

  function toggleCompleted(exerciseId: string) {
    setEntries((prev: SessionEntry[]) => prev.map((e) => (e.exerciseId === exerciseId ? { ...e, completed: !e.completed } : e)));
  }

  function addSet(exerciseId: string) {
    setEntries((prev: SessionEntry[]) =>
      prev.map((e) => {
        if (e.exerciseId !== exerciseId) return e;
        const last = e.sets[e.sets.length - 1];
        const set: WorkoutSet = {
          id: uid('set'),
          reps: last ? last.reps : '',
          weight: last ? last.weight : '',
          restSec: last ? last.restSec : 60,
          notes: '',
          completed: false,
        };
        return { ...e, sets: [...e.sets, set] };
      })
    );
  }

  function duplicateSet(exerciseId: string, setId: string) {
    setEntries((prev: SessionEntry[]) =>
      prev.map((e) => {
        if (e.exerciseId !== exerciseId) return e;
        const original = e.sets.find((st) => st.id === setId);
        if (!original) return e;
        return { ...e, sets: [...e.sets, { ...original, id: uid('set') }] };
      })
    );
  }

  function updateSet(exerciseId: string, setId: string, field: string, value: any) {
    setEntries((prev: SessionEntry[]) =>
      prev.map((e) => {
        if (e.exerciseId !== exerciseId) return e;
        return { ...e, sets: e.sets.map((st) => (st.id === setId ? { ...st, [field]: value } : st)) };
      })
    );
  }

  function removeSet(exerciseId: string, setId: string) {
    setEntries((prev: SessionEntry[]) =>
      prev.map((e) => (e.exerciseId === exerciseId ? { ...e, sets: e.sets.filter((st) => st.id !== setId) } : e))
    );
  }

  function toggleHistory(exerciseId: string) {
    setOpenHistoryFor((prev: Record<string, boolean>) => ({ ...prev, [exerciseId]: !prev[exerciseId] }));
  }

  function copyHistoricalSets(exerciseId: string, historicalSets: ExerciseHistoryRow[]) {
    setEntries((prev: SessionEntry[]) =>
      prev.map((e) => {
        if (e.exerciseId !== exerciseId) return e;
        const copied: WorkoutSet[] = historicalSets.map((st) => ({
          id: uid('set'),
          reps: st.reps,
          weight: st.weight,
          restSec: st.restSec || 60,
          notes: st.notes || '',
          completed: false,
        }));
        return { ...e, sets: [...e.sets, ...copied] };
      })
    );
  }

  return (
    <div>
      <div style={{ ...s.row, justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={s.row}>
          <button style={s.btnGhost} onClick={onClose}>← Voltar</button>
          <div style={{ ...s.h2, marginBottom: 0 }}>{fmtDate(date)}</div>
          <span style={{ ...s.small, color: saveStatus === 'saved' ? s.colors.green : s.colors.textDim }}>
            {saveStatus === 'pending' ? 'Salvando…' : saveStatus === 'saved' ? '✓ Salvo automaticamente' : 'Salva sozinho a cada alteração'}
          </span>
        </div>
        {existingSession && onDelete && (
          <button
            style={s.btnDanger}
            onClick={() => {
              // descarta qualquer alteração pendente pra não recriar o treino ao sair
              lastSavedRef.current = snapshotOf(latestRef.current);
              onDelete(existingSession.id);
            }}
          >
            excluir treino
          </button>
        )}
      </div>

      <div style={s.card}>
        <div style={s.row}>
          <select style={{ ...s.input, marginBottom: 0, flex: 1 }} value={planId} onChange={(e: any) => setPlanId(e.target.value)}>
            <option value="">Treino livre</option>
            {data.plans.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button style={s.btnGhost} onClick={loadFromPlan}>Carregar exercícios da ficha</button>
        </div>
        <div style={{ ...s.row, marginTop: 8 }}>
          <span style={s.small}>Duração (min):</span>
          <input
            type="number"
            style={{ ...s.input, marginBottom: 0, width: 90 }}
            value={durationMin}
            onChange={(e: any) => setDurationMin(e.target.value)}
          />
        </div>
      </div>

      <div style={s.card}>
        <div style={s.h2}>Copiar treino passado</div>
        {pastSessions.length === 0 ? (
          <div style={s.small}>Nenhum treino anterior registrado ainda.</div>
        ) : (
          <div style={s.row}>
            <select style={{ ...s.input, marginBottom: 0, flex: 1 }} value={copyFromSessionId} onChange={(e: any) => setCopyFromSessionId(e.target.value)}>
              <option value="">Selecione um treino anterior...</option>
              {pastSessions.map((sn: any) => (
                <option key={sn.id} value={sn.id}>
                  {fmtDate(sn.date)} — {sn.planName} ({sn.entries.length} exercícios)
                </option>
              ))}
            </select>
            <button style={s.btnGhost} onClick={copyPastWorkout} disabled={!copyFromSessionId}>
              Copiar
            </button>
          </div>
        )}
        <div style={{ ...s.small, marginTop: 6 }}>Substitui os exercícios/séries atuais pelos do treino escolhido.</div>
      </div>

      {entries.map((entry: any, entryIdx: number) => {
        const ex = data.exercises.find((e: any) => e.id === entry.exerciseId);
        const historyGroups = groupExerciseHistoryByDate(exerciseHistory(historySessions, entry.exerciseId));
        const isHistoryOpen = !!openHistoryFor[entry.exerciseId];
        const cfg = ex ? exerciseProgressionConfig(ex) : { repMin: DEFAULT_REP_MIN, repMax: DEFAULT_REP_MAX, increment: DEFAULT_WEIGHT_INCREMENT };
        const suggestion = suggestProgression(historySessions, entry.exerciseId, cfg.repMin, cfg.repMax, cfg.increment);

        return (
          <React.Fragment key={entry.exerciseId}>
          <div style={s.card}>
            <div style={{ ...s.row, justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...s.row, cursor: 'pointer' }}>
                <input type="checkbox" checked={entry.completed} onChange={() => toggleCompleted(entry.exerciseId)} />
                <ExercisePhotoField React={React} s={s} exercise={ex || { id: entry.exerciseId, name: entry.exerciseName, photo: null }} size={36} readOnly />
                <span style={{ fontWeight: 600, textDecoration: entry.completed ? 'line-through' : 'none' }}>{entry.exerciseName}</span>
              </label>
              <div style={s.row}>
                <button
                  title="Editar exercício (nome, capa, grupo muscular)"
                  style={{ ...s.btnSmall, padding: '4px 7px' }}
                  onClick={() => setExerciseForm({ exerciseId: entry.exerciseId })}
                >
                  ✎
                </button>
                <button
                  disabled={entryIdx === 0}
                  style={{ ...s.btnSmall, padding: '4px 7px', opacity: entryIdx === 0 ? 0.4 : 1 }}
                  onClick={() => moveEntry(entry.exerciseId, 'up')}
                >
                  ▲
                </button>
                <button
                  disabled={entryIdx === entries.length - 1}
                  style={{ ...s.btnSmall, padding: '4px 7px', opacity: entryIdx === entries.length - 1 ? 0.4 : 1 }}
                  onClick={() => moveEntry(entry.exerciseId, 'down')}
                >
                  ▼
                </button>
                <button style={s.btnSmall} onClick={() => addSet(entry.exerciseId)}>+ série</button>
                <button style={s.btnDanger} onClick={() => removeEntry(entry.exerciseId)}>remover</button>
              </div>
            </div>

            <div style={{ ...s.small, marginBottom: 6, color: s.colors.accent }}>
              🎯 Meta: {suggestion.suggestedWeight != null ? suggestion.suggestedWeight + 'kg × ' : ''}{suggestion.suggestedRepsTarget} reps
            </div>

            {historyGroups.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ ...s.link, fontSize: 12 }} onClick={() => toggleHistory(entry.exerciseId)}>
                  {isHistoryOpen ? '▾ ' : '▸ '}histórico ({historyGroups.length} treino{historyGroups.length > 1 ? 's' : ''} anterior{historyGroups.length > 1 ? 'es' : ''})
                </span>
                {isHistoryOpen && (
                  <div style={{ marginTop: 6 }}>
                    {historyGroups.map((g: any) => (
                      <div key={g.date} style={{ ...s.cardAlt, ...s.row, justifyContent: 'space-between' }}>
                        <div>
                          <div style={s.small}>{fmtDate(g.date)}</div>
                          <div style={{ fontSize: 12 }}>
                            {g.sets.map((st: any, i: number) => (st.weight || 0) + 'kg×' + (st.reps || 0)).join(' · ')}
                          </div>
                        </div>
                        <button style={s.btnSmall} onClick={() => copyHistoricalSets(entry.exerciseId, g.sets)}>copiar séries</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {entry.sets.length > 0 && (
              <div style={{ ...s.setRow, ...s.small, fontWeight: 600 }}>
                <span>#</span>
                <span>reps</span>
                <span>carga (kg)</span>
                <span>obs</span>
                <span></span>
                <span></span>
              </div>
            )}
            {entry.sets.map((st: any, idx: number) => (
              <div key={st.id} style={s.setRow}>
                <span style={s.small}>{idx + 1}</span>
                <input
                  style={{ ...s.input, marginBottom: 0, padding: '5px 6px' }}
                  type="number"
                  value={st.reps}
                  onChange={(e: any) => updateSet(entry.exerciseId, st.id, 'reps', e.target.value)}
                />
                <input
                  style={{ ...s.input, marginBottom: 0, padding: '5px 6px' }}
                  type="number"
                  value={st.weight}
                  onChange={(e: any) => updateSet(entry.exerciseId, st.id, 'weight', e.target.value)}
                />
                <input
                  style={{ ...s.input, marginBottom: 0, padding: '5px 6px' }}
                  value={st.notes}
                  onChange={(e: any) => updateSet(entry.exerciseId, st.id, 'notes', e.target.value)}
                />
                <button style={{ ...s.btnSmall, padding: '4px 6px' }} title="Copiar esta série" onClick={() => duplicateSet(entry.exerciseId, st.id)}>⧉</button>
                <button style={{ ...s.btnDanger, padding: '4px 6px' }} onClick={() => removeSet(entry.exerciseId, st.id)}>×</button>
              </div>
            ))}
          </div>
          {exerciseForm && exerciseForm.exerciseId === entry.exerciseId && (
            <ExerciseFormPanel
              key={entry.exerciseId}
              React={React}
              s={s}
              exercise={ex || null}
              categories={data.categories}
              onSave={saveExerciseForm}
              onCancel={() => setExerciseForm(null)}
            />
          )}
          </React.Fragment>
        );
      })}

      <div style={s.card}>
        <MuscleVolume React={React} s={s} rows={dayMuscleRows} title="Séries por grupo muscular (este treino)" emptyText="Nenhuma série lançada ainda." />
      </div>

      <div style={s.card}>
        <div style={s.h2}>Ficha</div>
        {selectedPlan ? (
          <div style={{ marginBottom: 10 }}>
            <button style={s.btnGhost} onClick={updatePlanWithTodayOrder} disabled={orderedExerciseIds.length === 0}>
              Atualizar "{selectedPlan.name}" com esta ordem
            </button>
          </div>
        ) : null}
        {showNewPlanForm ? (
          <div style={s.row}>
            <input
              style={{ ...s.input, marginBottom: 0, flex: 1 }}
              placeholder="Nome da nova ficha"
              value={newPlanName}
              onChange={(e: any) => setNewPlanName(e.target.value)}
            />
            <button style={s.btn} onClick={createPlanFromTodayOrder}>Criar</button>
            <button style={s.btnGhost} onClick={() => setShowNewPlanForm(false)}>Cancelar</button>
          </div>
        ) : (
          <button style={s.btnGhost} onClick={() => setShowNewPlanForm(true)} disabled={orderedExerciseIds.length === 0}>
            + Criar nova ficha com estes exercícios
          </button>
        )}
      </div>

      {exerciseForm && !exerciseForm.exerciseId && (
        <ExerciseFormPanel
          key="novo"
          React={React}
          s={s}
          exercise={null}
          categories={data.categories}
          onSave={saveExerciseForm}
          onCancel={() => setExerciseForm(null)}
        />
      )}

      <div style={s.card}>
        <div style={{ ...s.row, justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ ...s.h2, marginBottom: 0 }}>Adicionar exercício</div>
          <button
            title="Criar um exercício novo"
            style={{ ...s.btnSmall, fontSize: 14, padding: '4px 10px' }}
            onClick={() => setExerciseForm({ exerciseId: null })}
          >
            ＋ novo
          </button>
        </div>
        <ExercisePicker
          React={React}
          s={s}
          exercises={data.exercises.filter((ex: any) => !entries.some((e: any) => e.exerciseId === ex.id))}
          categories={data.categories}
          onPick={(exId: string) => {
            const ex = data.exercises.find((e: any) => e.id === exId);
            if (!ex) return;
            // sempre no final da lista do dia
            setEntries((prev: SessionEntry[]) => [...prev, { exerciseId: ex.id, exerciseName: ex.name, completed: false, sets: [] }]);
          }}
        />
      </div>

      <div style={s.row}>
        <button style={s.btn} onClick={onClose}>← Voltar ao calendário</button>
        <span style={s.small}>{saveStatus === 'pending' ? 'Salvando…' : 'Tudo salvo automaticamente'}</span>
      </div>
    </div>
  );
}

// ---- src/componentes/WeekStrip.tsx ----
// componentes/WeekStrip.tsx
// Uma semana em colunas (uma por dia). Cada coluna tem dois atalhos
// rápidos — importar uma ficha inteira ou adicionar um exercício avulso —
// clicar no nome de um exercício expande e permite editar as séries
// (reps/carga) na hora, sem precisar abrir o formulário do dia inteiro.
// Clicar na data abre o dia completo mesmo assim, se precisar de mais
// controle (duração, ficha, histórico, etc.).
function WeekStrip({ React, s, data, actions, dates, onOpenDay }: any) {
  const todayIso = todayStr();
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  function toggle(key: string) {
    setExpanded((prev: Record<string, boolean>) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
      {dates.map((dateIso: string) => {
        const session = data.sessions.find((sn: any) => sn.date === dateIso) || null;
        const isToday = dateIso === todayIso;
        const dayLabel = WEEKDAY_LABELS[weekdayKeyOfIso(dateIso)];
        const dayNum = Number(dateIso.slice(8, 10));

        return (
          <div
            key={dateIso}
            style={{
              ...s.cardAlt,
              marginBottom: 0,
              minWidth: 168,
              flex: '0 0 auto',
              border: isToday ? '1px solid ' + s.colors.accent : '1px solid ' + s.colors.border,
            }}
          >
            <div style={{ ...s.small, cursor: 'pointer', fontWeight: isToday ? 700 : 600, color: isToday ? s.colors.text : s.colors.textDim }} onClick={() => onOpenDay(dateIso)}>
              {dayLabel} {dayNum}
            </div>

            <div style={{ margin: '6px 0' }}>
              {session ? (
                session.entries.map((e: any, idx: number) => {
                  const ex = data.exercises.find((x: any) => x.id === e.exerciseId);
                  const key = dateIso + '|' + e.exerciseId;
                  const isOpen = !!expanded[key];
                  return (
                    <div key={e.exerciseId} style={{ marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ExercisePhotoField React={React} s={s} exercise={ex || { id: e.exerciseId, name: e.exerciseName, photo: null }} size={32} readOnly />
                        <span
                          onClick={() => toggle(key)}
                          style={{
                            flex: 1,
                            fontSize: 11,
                            color: s.colors.textDim,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'pointer',
                          }}
                        >
                          {isOpen ? '▾ ' : '▸ '}
                          {e.completed ? '✓ ' : ''}
                          {e.exerciseName}
                        </span>
                        <button
                          disabled={idx === 0}
                          style={{ border: 'none', background: 'transparent', color: idx === 0 ? s.colors.border : s.colors.textDim, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 10, padding: 0 }}
                          onClick={() => actions.moveSessionEntry(session.id, e.exerciseId, 'up')}
                        >
                          ▲
                        </button>
                        <button
                          disabled={idx === session.entries.length - 1}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: idx === session.entries.length - 1 ? s.colors.border : s.colors.textDim,
                            cursor: idx === session.entries.length - 1 ? 'default' : 'pointer',
                            fontSize: 10,
                            padding: 0,
                          }}
                          onClick={() => actions.moveSessionEntry(session.id, e.exerciseId, 'down')}
                        >
                          ▼
                        </button>
                      </div>

                      {isOpen && (
                        <div style={{ marginLeft: 36, marginTop: 4 }}>
                          {e.sets.map((st: any, si: number) => (
                            <div key={st.id} style={{ display: 'grid', gridTemplateColumns: '14px 1fr 1fr 18px 18px', gap: 3, alignItems: 'center', marginBottom: 3 }}>
                              <span style={{ fontSize: 9, color: s.colors.textDim }}>{si + 1}</span>
                              <input
                                type="number"
                                placeholder="reps"
                                style={{ ...s.input, marginBottom: 0, padding: '3px 4px', fontSize: 10 }}
                                value={st.reps}
                                onChange={(ev: any) => actions.updateSetInSession(session.id, e.exerciseId, st.id, 'reps', ev.target.value)}
                              />
                              <input
                                type="number"
                                placeholder="kg"
                                style={{ ...s.input, marginBottom: 0, padding: '3px 4px', fontSize: 10 }}
                                value={st.weight}
                                onChange={(ev: any) => actions.updateSetInSession(session.id, e.exerciseId, st.id, 'weight', ev.target.value)}
                              />
                              <button
                                style={{ border: 'none', background: 'transparent', color: s.colors.textDim, cursor: 'pointer', fontSize: 11, padding: 0 }}
                                title="Copiar esta série"
                                onClick={() => actions.duplicateSetInSession(session.id, e.exerciseId, st.id)}
                              >
                                ⧉
                              </button>
                              <button
                                style={{ border: 'none', background: 'transparent', color: s.colors.red, cursor: 'pointer', fontSize: 12, padding: 0 }}
                                onClick={() => actions.removeSetFromSession(session.id, e.exerciseId, st.id)}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button style={{ ...s.btnSmall, fontSize: 10, padding: '3px 6px' }} onClick={() => actions.addSetToSession(session.id, e.exerciseId)}>
                            + série
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <span style={{ fontSize: 11, color: s.colors.textDim }}>—</span>
              )}
            </div>

            <select
              style={{ ...s.input, marginBottom: 6, padding: '4px 6px', fontSize: 11 }}
              value=""
              onChange={(e: any) => {
                if (e.target.value) actions.importPlanToDate(dateIso, e.target.value);
              }}
            >
              <option value="">Importar ficha...</option>
              {data.plans.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              style={{ ...s.input, marginBottom: 0, padding: '4px 6px', fontSize: 11 }}
              value=""
              onChange={(e: any) => {
                if (e.target.value) actions.quickAddExercise(dateIso, e.target.value);
              }}
            >
              <option value="">+ Exercício...</option>
              {data.exercises.map((ex: any) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

// ---- src/paginas/DashboardPage.tsx ----
// paginas/DashboardPage.tsx
// Sem sistema de sessão: mostra o que já foi registrado e a ficha
// agendada para hoje (só leitura, sem botão de iniciar/cronômetro).
function DashboardPage({ React, s, data, actions, onOpenDay, onOpenExercise }: any) {
  const sessions = data.sessions;
  const last = sessions[0];
  const streak = calcStreak(sessions);
  const vol = weeklyVolume(sessions);
  const top = mostExecuted(sessions, 5);
  const todaySession = sessions.find((sn: any) => sn.date === todayStr());
  const todayKey = weekdayKeyOf(new Date());
  const scheduledPlanId = data.weekSchedule[todayKey];
  const scheduledPlan = scheduledPlanId ? data.plans.find((p: any) => p.id === scheduledPlanId) : null;
  const currentWeekDates = datesOfWeek(weekStartOf(new Date()));
  const weekSessions = sessionsBetween(sessions, currentWeekDates[0], currentWeekDates[6]);
  const weekMuscleRows = setsByCategory(weekSessions, data.exercises, data.categories);
  const mRange = monthRange(new Date().getFullYear(), new Date().getMonth());
  const monthSessions = sessionsBetween(sessions, mRange.from, mRange.to);
  const monthMuscleRows = setsByCategory(monthSessions, data.exercises, data.categories);

  return (
    <div>
      <div style={s.card}>
        <div style={s.h2}>Esta semana</div>
        <WeekStrip React={React} s={s} data={data} actions={actions} dates={currentWeekDates} onOpenDay={onOpenDay} />
      </div>

      <div style={s.grid}>
        <StatCard React={React} s={s} value={todaySession ? '✓' : '-'} label={todaySession ? 'Treino de hoje concluído' : 'Nenhum treino hoje ainda'} />
        <StatCard React={React} s={s} value={streak} label="Dias seguidos treinando" />
        <StatCard React={React} s={s} value={vol.toLocaleString('pt-BR')} label="Volume semanal (kg × reps)" />
        <StatCard React={React} s={s} value={sessions.length} label="Treinos no histórico" />
      </div>

      <div style={s.card}>
        <div style={s.h2}>Treino de hoje (divisão semanal)</div>
        {scheduledPlan ? (
          <div style={{ ...s.row, justifyContent: 'space-between' }}>
            <span>{scheduledPlan.name}{todaySession ? ' — concluído ✓' : ''}</span>
          </div>
        ) : (
          <div style={s.small}>Nenhuma ficha agendada para hoje. Configure na aba Semana.</div>
        )}
      </div>

      <div style={s.card}>
        <div style={s.h2}>Último treino</div>
        {last ? (
          <div>
            <div>{last.planName} — {fmtDate(last.date)}</div>
            <div style={s.small}>{fmtMin(last.durationMin)} · volume {sessionVolume(last).toLocaleString('pt-BR')}</div>
          </div>
        ) : (
          <div style={s.small}>Nenhum treino registrado ainda.</div>
        )}
      </div>

      <div style={s.card}>
        <div style={s.h2}>Séries por grupo muscular</div>
        <div style={{ marginBottom: 14 }}>
          <MuscleVolume React={React} s={s} rows={weekMuscleRows} title="Esta semana" emptyText="Nenhuma série registrada nesta semana." />
        </div>
        <MuscleVolume React={React} s={s} rows={monthMuscleRows} title={monthLabel(new Date().getFullYear(), new Date().getMonth())} emptyText="Nenhuma série registrada neste mês." />
      </div>

      <div style={s.card}>
        <div style={s.h2}>Exercícios</div>
        {data.exercises.length === 0 ? (
          <div style={s.small}>Nenhum exercício cadastrado ainda. Adicione na aba Exercícios.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.exercises.map((ex: any) => (
              <div
                key={ex.id}
                style={{ ...s.cardAlt, marginBottom: 0, width: 96, textAlign: 'center', cursor: 'pointer' }}
                onClick={() => onOpenExercise(ex.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                  <ExercisePhotoField React={React} s={s} exercise={ex} size={64} readOnly />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={s.card}>
        <div style={s.h2}>Exercícios mais executados</div>
        {top.length === 0 ? (
          <div style={s.small}>Sem dados suficientes ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {top.map(([exerciseId, count]: any) => {
              const ex = data.exercises.find((e: any) => e.id === exerciseId);
              return (
                <div
                  key={exerciseId}
                  style={{ ...s.cardAlt, marginBottom: 0, width: 96, textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => onOpenExercise(exerciseId)}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                    <ExercisePhotoField React={React} s={s} exercise={ex || { id: exerciseId, name: '?', photo: null }} size={64} readOnly />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ex ? ex.name : '(removido)'}
                  </div>
                  <span style={s.badge}>{count}x</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- src/paginas/ExercisesPage.tsx ----
// paginas/ExercisesPage.tsx
function ExercisesPage({ React, s, data, actions, search, setSearch, onOpenExercise }: any) {
  const [newExName, setNewExName] = React.useState('');
  const [newExCat, setNewExCat] = React.useState(data.categories[0] ? data.categories[0].id : '');
  const [newCatName, setNewCatName] = React.useState('');

  function matchesSearch(text: string) {
    if (!search.trim()) return true;
    return text.toLowerCase().includes(search.trim().toLowerCase());
  }

  return (
    <div>
      <div style={s.card}>
        <div style={s.h2}>Nova categoria</div>
        <div style={s.row}>
          <input
            style={{ ...s.input, marginBottom: 0, flex: 1 }}
            placeholder="Nome da categoria"
            value={newCatName}
            onChange={(e: any) => setNewCatName(e.target.value)}
          />
          <button
            style={s.btnGhost}
            onClick={() => {
              actions.addCategory(newCatName);
              setNewCatName('');
            }}
          >
            + Categoria
          </button>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.h2}>Novo exercício</div>
        <input
          style={s.input}
          placeholder="Nome do exercício"
          value={newExName}
          onChange={(e: any) => setNewExName(e.target.value)}
        />
        <div style={s.row}>
          <select
            style={{ ...s.input, marginBottom: 0, flex: 1 }}
            value={newExCat}
            onChange={(e: any) => setNewExCat(e.target.value)}
          >
            {data.categories.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            style={s.btn}
            onClick={() => {
              actions.addExercise(newExName, newExCat);
              setNewExName('');
            }}
          >
            + Exercício
          </button>
        </div>
      </div>

      <SearchInput React={React} s={s} value={search} onChange={setSearch} placeholder="🔎 Buscar exercício..." />

      {data.categories.map((cat: any) => {
        const exs = data.exercises.filter((e: any) => e.categoryId === cat.id && matchesSearch(e.name));
        if (exs.length === 0) return null;
        return (
          <div key={cat.id} style={s.card}>
            <div style={s.h2}>{cat.name}</div>
            {exs.map((ex: any) => (
              <ExerciseListItem key={ex.id} React={React} s={s} exercise={ex} onOpen={onOpenExercise} onDelete={actions.deleteExercise} onSetPhoto={actions.setExercisePhoto} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ---- src/paginas/ExerciseDetailPage.tsx ----
// paginas/ExerciseDetailPage.tsx
function ExerciseDetailPage({ React, s, data, actions, exerciseId, onBack }: any) {
  const ex = data.exercises.find((e: any) => e.id === exerciseId);
  if (!ex) return <div style={s.small}>Exercício não encontrado.</div>;

  const rows = exerciseHistory(data.sessions, ex.id);
  const pr = personalRecord(data.sessions, ex.id);
  const cfg = exerciseProgressionConfig(ex);
  const suggestion = suggestProgression(data.sessions, ex.id, cfg.repMin, cfg.repMax, cfg.increment);

  const [repMin, setRepMin] = React.useState(cfg.repMin);
  const [repMax, setRepMax] = React.useState(cfg.repMax);
  const [increment, setIncrement] = React.useState(cfg.increment);

  function saveConfig() {
    actions.updateExerciseProgression(ex.id, Number(repMin) || DEFAULT_REP_MIN, Number(repMax) || DEFAULT_REP_MAX, Number(increment) || DEFAULT_WEIGHT_INCREMENT);
  }

  return (
    <div>
      <button style={s.btnGhost} onClick={onBack}>← Voltar</button>
      <h3 style={{ ...s.h1, marginTop: 12 }}>{ex.name}</h3>

      <div style={s.card}>
        <ExercisePhotoField React={React} s={s} exercise={ex} onSetPhoto={actions.setExercisePhoto} size={140} />
      </div>

      <div style={s.card}>
        <div style={s.h2}>Progressão de carga</div>
        <div
          style={{
            ...s.cardAlt,
            border: '1px solid ' + (suggestion.readyToIncreaseWeight ? s.colors.green : s.colors.accent),
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>
            {suggestion.suggestedWeight != null ? suggestion.suggestedWeight + ' kg × ' + suggestion.suggestedRepsTarget + ' reps' : suggestion.suggestedRepsTarget + ' reps'}
          </div>
          <div style={s.small}>{suggestion.message}</div>
        </div>

        <div style={s.label}>Faixa de repetições (método de progressão dupla):</div>
        <div style={{ ...s.row, marginBottom: 8 }}>
          <input type="number" style={{ ...s.input, marginBottom: 0, width: 60 }} value={repMin} onChange={(e: any) => setRepMin(e.target.value)} />
          <span style={s.small}>a</span>
          <input type="number" style={{ ...s.input, marginBottom: 0, width: 60 }} value={repMax} onChange={(e: any) => setRepMax(e.target.value)} />
          <span style={s.small}>reps · incremento</span>
          <input type="number" style={{ ...s.input, marginBottom: 0, width: 60 }} value={increment} onChange={(e: any) => setIncrement(e.target.value)} />
          <span style={s.small}>kg</span>
        </div>
        <button style={s.btnGhost} onClick={saveConfig}>Salvar faixa</button>
      </div>

      <div style={s.card}>
        <div style={s.h2}>Recorde pessoal (PR)</div>
        {pr ? (
          <div>{pr.weight} kg × {pr.reps} reps — {fmtDate(pr.date)}</div>
        ) : (
          <div style={s.small}>Ainda sem registros.</div>
        )}
      </div>

      <div style={s.card}>
        <div style={s.h2}>Evolução (pronta para gráfico: pares data/carga/reps)</div>
        {rows.length === 0 ? (
          <div style={s.small}>Sem histórico ainda.</div>
        ) : (
          rows.map((r: any, i: number) => (
            <div key={i} style={{ ...s.cardAlt, ...s.row, justifyContent: 'space-between' }}>
              <span>{fmtDate(r.date)}</span>
              <span>{r.weight || 0} kg × {r.reps || 0} reps</span>
              <span style={s.small}>{r.restSec ? r.restSec + 's descanso' : ''}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---- src/paginas/PlansPage.tsx ----
// paginas/PlansPage.tsx
function PlansPage({ React, s, data, actions }: any) {
  const [newPlanName, setNewPlanName] = React.useState('');
  const [newPlanExIds, setNewPlanExIds] = React.useState<string[]>([]);

  function togglePlanExercise(exId: string) {
    setNewPlanExIds((prev: string[]) => (prev.includes(exId) ? prev.filter((x) => x !== exId) : [...prev, exId]));
  }

  return (
    <div>
      <div style={s.card}>
        <div style={s.h2}>Nova ficha (A, B, C...)</div>
        <input
          style={s.input}
          placeholder="Nome da ficha (ex: Treino A - Peito/Tríceps)"
          value={newPlanName}
          onChange={(e: any) => setNewPlanName(e.target.value)}
        />
        <div style={s.label}>Selecione os exercícios:</div>
        <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 10 }}>
          {data.exercises.length === 0 ? (
            <div style={s.small}>Cadastre exercícios primeiro na aba Exercícios.</div>
          ) : (
            data.exercises.map((ex: any) => (
              <label key={ex.id} style={{ ...s.row, marginBottom: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={newPlanExIds.includes(ex.id)} onChange={() => togglePlanExercise(ex.id)} />
                <span>{ex.name}</span>
              </label>
            ))
          )}
        </div>
        <button
          style={s.btn}
          onClick={() => {
            actions.createPlan(newPlanName, newPlanExIds);
            setNewPlanName('');
            setNewPlanExIds([]);
          }}
        >
          + Criar ficha
        </button>
      </div>

      {data.plans.map((p: any) => (
        <PlanCard
          key={p.id}
          React={React}
          s={s}
          plan={p}
          exercises={data.exercises}
          categories={data.categories}
          onDelete={actions.deletePlan}
          onUpdate={actions.updatePlanExercises}
          onCreateExercise={actions.addExerciseToPlan}
        />
      ))}
    </div>
  );
}

// ---- src/paginas/WeekPage.tsx ----
// paginas/WeekPage.tsx
// Sem sistema de sessão: mostra a divisão semanal e a agenda dos
// próximos dias, só como planejamento.
function WeekPage({ React, s, data, actions }: any) {
  const upcoming = upcomingSchedule(data.weekSchedule, data.plans);

  return (
    <div>
      <div style={s.card}>
        <div style={s.h2}>Divisão semanal</div>
        <div style={{ ...s.small, marginBottom: 10 }}>Escolha qual ficha treinar em cada dia da semana.</div>
        {data.plans.length === 0 ? (
          <div style={s.small}>Crie uma ficha na aba Fichas antes de montar a divisão semanal.</div>
        ) : (
          WEEKDAY_KEYS.map((dayKey: WeekDayKey) => (
            <div key={dayKey} style={{ ...s.row, justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ width: 90, fontWeight: 600 }}>{WEEKDAY_LABELS[dayKey]}</span>
              <select
                style={{ ...s.input, marginBottom: 0, flex: 1 }}
                value={data.weekSchedule[dayKey] || ''}
                onChange={(e: any) => actions.setWeekScheduleDay(dayKey, e.target.value || null)}
              >
                <option value="">Descanso / sem ficha</option>
                {data.plans.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          ))
        )}
      </div>

      <div style={s.card}>
        <div style={s.h2}>Próximos 7 dias</div>
        {upcoming.map((item: any) => (
          <div key={item.date} style={{ ...s.cardAlt, ...s.row, justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: item.isToday ? 700 : 400 }}>
                {item.isToday ? 'Hoje · ' : ''}{item.dayLabel} ({fmtDate(item.date)})
              </div>
              <div style={s.small}>{item.plan ? item.plan.name : 'Descanso'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- src/paginas/CalendarPage.tsx ----
// paginas/CalendarPage.tsx
// Mês quebrado em semanas (cada uma como uma WeekStrip com os atalhos
// rápidos). Clicar numa data abre o SessionEditor pra registrar/editar o
// treino completo daquele dia. `selectedDate`/`setSelectedDate` vêm de
// fora (do componente raiz) para que o Dashboard também consiga abrir um
// dia direto nesta aba.
function CalendarPage({ React, s, data, actions, selectedDate, setSelectedDate }: any) {
  const today = new Date();
  const [year, setYear] = React.useState(today.getFullYear());
  const [month, setMonth] = React.useState(today.getMonth());

  const weeks = buildMonthWeeks(year, month);
  const monthPrefix = year + '-' + String(month + 1).padStart(2, '0');

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  if (selectedDate) {
    const existing = sessionsOnDate(data.sessions, selectedDate)[0] || null;
    return (
      <SessionEditor
        key={selectedDate}
        React={React}
        s={s}
        data={data}
        date={selectedDate}
        existingSession={existing}
        onClose={() => setSelectedDate(null)}
        onAutoSave={(planId: string | null, entries: any, durationMin: number) => {
          // grava sem fechar o formulário. Sem exercícios = não há treino a guardar.
          const current = sessionsOnDate(data.sessions, selectedDate)[0] || null;
          if (entries.length === 0) {
            if (current) actions.deleteSession(current.id);
            return;
          }
          if (current) {
            actions.updateSession(current.id, planId, entries, durationMin);
          } else {
            actions.createSession(selectedDate, planId, entries, durationMin);
          }
        }}
        onDelete={(sessionId: string) => {
          actions.deleteSession(sessionId);
          setSelectedDate(null);
        }}
        onUpdatePlanOrder={actions.updatePlanExercises}
        onCreatePlanFromOrder={actions.createPlan}
        onCreateExercise={actions.createExercise}
        onUpdateExercise={actions.updateExercise}
      />
    );
  }

  return (
    <div>
      <div style={{ ...s.card, ...s.row, justifyContent: 'space-between' }}>
        <button style={s.btnGhost} onClick={prevMonth}>←</button>
        <div style={{ fontWeight: 700 }}>{monthLabel(year, month)}</div>
        <button style={s.btnGhost} onClick={nextMonth}>→</button>
      </div>

      {weeks.map((weekDates: string[]) => (
        <div key={weekDates[0]} style={s.card}>
          <div style={{ ...s.small, marginBottom: 6 }}>Semana {weekLabel(weekDates[0])}</div>
          <WeekStrip React={React} s={s} data={data} actions={actions} dates={weekDates} onOpenDay={setSelectedDate} />
        </div>
      ))}

      <div style={s.small}>Clique na data de um dia para abrir o registro completo (séries, duração, etc.).</div>
    </div>
  );
}

// ---- src/paginas/HistoryPage.tsx ----
// paginas/HistoryPage.tsx
function HistoryPage({ React, s, data, search, setSearch, selectedSessionId, setSelectedSessionId }: any) {
  function matchesSearch(text: string) {
    if (!search.trim()) return true;
    return text.toLowerCase().includes(search.trim().toLowerCase());
  }

  if (selectedSessionId) {
    const sn = data.sessions.find((x: any) => x.id === selectedSessionId);
    if (!sn) return <div style={s.small}>Sessão não encontrada.</div>;
    return (
      <div>
        <button style={s.btnGhost} onClick={() => setSelectedSessionId(null)}>← Voltar ao histórico</button>
        <div style={{ ...s.card, marginTop: 12 }}>
          <div style={s.h1}>{sn.planName}</div>
          <div style={s.small}>{fmtDate(sn.date)} · {fmtMin(sn.durationMin)} · volume {sessionVolume(sn).toLocaleString('pt-BR')}</div>
        </div>
        {sn.entries.map((entry: any) => (
          <div key={entry.exerciseId} style={s.card}>
            <div style={s.h2}>{entry.exerciseName}{entry.completed ? ' ✓' : ''}</div>
            {entry.sets.map((st: any, i: number) => (
              <div key={st.id} style={{ ...s.cardAlt, ...s.row, justifyContent: 'space-between' }}>
                <span>Série {i + 1}</span>
                <span>{st.weight || 0} kg × {st.reps || 0} reps</span>
                <span style={s.small}>{st.notes || ''}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const filtered = data.sessions.filter((sn: any) => matchesSearch(sn.planName));
  const weeks = groupSessionsByWeek(filtered);

  return (
    <div>
      <SearchInput React={React} s={s} value={search} onChange={setSearch} placeholder="🔎 Buscar no histórico de treinos..." />
      {weeks.length === 0 ? (
        <div style={s.small}>Nenhum treino no histórico ainda.</div>
      ) : (
        weeks.map((week: any) => (
          <div key={week.weekStart} style={{ marginBottom: 16 }}>
            <div style={{ ...s.row, justifyContent: 'space-between', margin: '4px 2px 8px' }}>
              <span style={{ fontWeight: 700 }}>Semana {week.label}</span>
              <span style={s.badge}>volume {week.totalVolume.toLocaleString('pt-BR')}</span>
            </div>
            {week.sessions.map((sn: any) => (
              <div key={sn.id} style={{ ...s.card, cursor: 'pointer' }} onClick={() => setSelectedSessionId(sn.id)}>
                <div style={{ ...s.row, justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{sn.planName}</span>
                  <span style={s.small}>{fmtDate(sn.date)}</span>
                </div>
                <div style={s.small}>{fmtMin(sn.durationMin)} · volume {sessionVolume(sn).toLocaleString('pt-BR')} · {sn.entries.length} exercícios</div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

// ---- src/app.entry.tsx ----
// app.entry.tsx
// Ponto de entrada exigido pelo runtime: export default de um componente
// React recebendo { modApi, React }. Só orquestra — toda a lógica de
// negócio mora em stores/, hooks/ e servicos/; toda a apresentação mora
// em componentes/ e paginas/. Sem sistema de sessão: os treinos ficam
// organizados por ficha + divisão semanal, e o histórico é só leitura.

export default function Modification({ modApi, React }: { modApi: ModApi; React: any }) {
  const s = buildStyles();
  const { data, loading, actions } = useWorkoutStore(modApi, React);

  const [view, setView] = React.useState('dashboard');
  const [search, setSearch] = React.useState('');
  const [selectedExerciseId, setSelectedExerciseId] = React.useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = React.useState<string | null>(null);

  if (loading || !data) {
    return (
      <div style={s.root}>
        <p style={s.small}>Carregando Workout Log...</p>
      </div>
    );
  }

  const tabs = [
    { key: 'dashboard', label: 'Home' },
    { key: 'exercises', label: 'Exercícios' },
    { key: 'plans', label: 'Fichas' },
    { key: 'week', label: 'Semana' },
    { key: 'calendar', label: 'Calendário' },
    { key: 'history', label: 'Histórico' },
  ];

  function changeTab(key: string) {
    setSelectedSessionId(null);
    setSelectedCalendarDate(null);
    setSearch('');
    setView(key);
  }

  function openExercise(id: string) {
    setSelectedExerciseId(id);
    setView('exercise-detail');
  }

  let page = null;
  if (view === 'dashboard') {
    page = (
      <DashboardPage
        React={React}
        s={s}
        data={data}
        actions={actions}
        onOpenDay={(date: string) => {
          setSelectedCalendarDate(date);
          setView('calendar');
        }}
        onOpenExercise={openExercise}
      />
    );
  } else if (view === 'exercises') {
    page = <ExercisesPage React={React} s={s} data={data} actions={actions} search={search} setSearch={setSearch} onOpenExercise={openExercise} />;
  } else if (view === 'exercise-detail') {
    page = <ExerciseDetailPage React={React} s={s} data={data} actions={actions} exerciseId={selectedExerciseId} onBack={() => setView('exercises')} />;
  } else if (view === 'plans') {
    page = <PlansPage React={React} s={s} data={data} actions={actions} />;
  } else if (view === 'week') {
    page = <WeekPage React={React} s={s} data={data} actions={actions} />;
  } else if (view === 'calendar') {
    page = <CalendarPage React={React} s={s} data={data} actions={actions} selectedDate={selectedCalendarDate} setSelectedDate={setSelectedCalendarDate} />;
  } else if (view === 'history') {
    page = (
      <HistoryPage
        React={React}
        s={s}
        data={data}
        search={search}
        setSearch={setSearch}
        selectedSessionId={selectedSessionId}
        setSelectedSessionId={setSelectedSessionId}
      />
    );
  }

  return (
    <div style={s.root}>
      <div style={s.h1}>Workout Log</div>
      <div style={{ ...s.small, marginBottom: 14 }}>{modApi.projectName}</div>
      <Tabs React={React} s={s} tabs={tabs} active={view} onChange={changeTab} />
      {page}
    </div>
  );
}
