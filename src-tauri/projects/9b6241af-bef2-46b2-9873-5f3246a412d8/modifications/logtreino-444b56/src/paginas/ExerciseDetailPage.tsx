// paginas/ExerciseDetailPage.tsx
function ExerciseDetailPage({ React, s, data, actions, exerciseId, onBack }: any) {
  const ex = data.exercises.find((e: any) => e.id === exerciseId);
  if (!ex) return <div style={s.small}>Exercício não encontrado.</div>;

  const rows = exerciseHistory(data.sessions, ex.id);
  const pr = personalRecord(data.sessions, ex.id);

  return (
    <div>
      <button style={s.btnGhost} onClick={onBack}>← Voltar</button>
      <h3 style={{ ...s.h1, marginTop: 12 }}>{ex.name}</h3>

      <div style={s.card}>
        <ExercisePhotoField React={React} s={s} exercise={ex} onSetPhoto={actions.setExercisePhoto} size={140} />
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
