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
