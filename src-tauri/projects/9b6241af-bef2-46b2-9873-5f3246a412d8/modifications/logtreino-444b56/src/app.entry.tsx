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

  if (loading || !data) {
    return (
      <div style={s.root}>
        <p style={s.small}>Carregando Workout Log...</p>
      </div>
    );
  }

  const tabs = [
    { key: 'dashboard', label: 'Hoje' },
    { key: 'exercises', label: 'Exercícios' },
    { key: 'plans', label: 'Fichas' },
    { key: 'week', label: 'Semana' },
    { key: 'history', label: 'Histórico' },
  ];

  function changeTab(key: string) {
    setSelectedSessionId(null);
    setSearch('');
    setView(key);
  }

  function openExercise(id: string) {
    setSelectedExerciseId(id);
    setView('exercise-detail');
  }

  let page = null;
  if (view === 'dashboard') {
    page = <DashboardPage React={React} s={s} data={data} />;
  } else if (view === 'exercises') {
    page = <ExercisesPage React={React} s={s} data={data} actions={actions} search={search} setSearch={setSearch} onOpenExercise={openExercise} />;
  } else if (view === 'exercise-detail') {
    page = <ExerciseDetailPage React={React} s={s} data={data} actions={actions} exerciseId={selectedExerciseId} onBack={() => setView('exercises')} />;
  } else if (view === 'plans') {
    page = <PlansPage React={React} s={s} data={data} actions={actions} />;
  } else if (view === 'week') {
    page = <WeekPage React={React} s={s} data={data} actions={actions} />;
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
