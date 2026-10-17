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
