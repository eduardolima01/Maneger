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
