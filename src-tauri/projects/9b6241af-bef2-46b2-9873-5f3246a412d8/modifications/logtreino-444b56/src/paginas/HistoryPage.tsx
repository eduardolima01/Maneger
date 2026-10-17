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
