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
      count[e.exerciseName] = (count[e.exerciseName] || 0) + 1;
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
