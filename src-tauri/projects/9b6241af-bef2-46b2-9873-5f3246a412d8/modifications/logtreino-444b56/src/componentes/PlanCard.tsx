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
