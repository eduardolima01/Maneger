// paginas/DashboardPage.tsx
// Sem sistema de sessão: mostra o que já foi registrado e a ficha
// agendada para hoje (só leitura, sem botão de iniciar/cronômetro).
function DashboardPage({ React, s, data }: any) {
  const sessions = data.sessions;
  const last = sessions[0];
  const streak = calcStreak(sessions);
  const vol = weeklyVolume(sessions);
  const top = mostExecuted(sessions, 5);
  const todaySession = sessions.find((sn: any) => sn.date === todayStr());
  const todayKey = weekdayKeyOf(new Date());
  const scheduledPlanId = data.weekSchedule[todayKey];
  const scheduledPlan = scheduledPlanId ? data.plans.find((p: any) => p.id === scheduledPlanId) : null;

  return (
    <div>
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
        <div style={s.h2}>Exercícios mais executados</div>
        {top.length === 0 ? (
          <div style={s.small}>Sem dados suficientes ainda.</div>
        ) : (
          <div>
            {top.map(([name, count]: any) => (
              <div key={name} style={{ ...s.row, justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{name}</span>
                <span style={s.badge}>{count}x</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
