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
