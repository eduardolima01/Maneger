// hooks/useWorkoutStore.ts
// Único ponto de contato com modApi.storage. Conecta as funções puras de
// stores/workout.store.ts ao ciclo de vida do React (useState/useEffect).
//
// "React" não pode ser importado (não existe import no runtime), então é
// recebido como parâmetro, igual ao componente principal recebe.

function useWorkoutStore(modApi: ModApi, React: any) {
  const [data, setData] = React.useState<WorkoutData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    modApi.storage.get().then((raw: any) => {
      if (!alive) return;
      const hasData = raw && Object.keys(raw).length > 0;
      const initial = normalizeData(raw);
      setData(initial);
      setLoading(false);
      if (!hasData) modApi.storage.set(initial);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function persist(next: WorkoutData) {
    setData(next);
    await modApi.storage.set(next);
  }

  // Cada ação abaixo = uma função pura do store + persistência.
  // Mantém o componente principal livre de lógica de negócio.
  const actions = {
    addCategory: (name: string) => data && persist(addCategoryToData(data, name)),
    addExercise: (name: string, categoryId: string) => data && persist(addExerciseToData(data, name, categoryId)),
    deleteExercise: (id: string) => data && persist(deleteExerciseFromData(data, id)),
    createPlan: (name: string, exerciseIds: string[]) => data && persist(createPlanInData(data, name, exerciseIds)),
    deletePlan: (id: string) => data && persist(deletePlanFromData(data, id)),
    setWeekScheduleDay: (dayKey: WeekDayKey, planId: string | null) => data && persist(setWeekScheduleDayInData(data, dayKey, planId)),
    updatePlanExercises: (planId: string, exerciseIds: string[]) => data && persist(updatePlanExercisesInData(data, planId, exerciseIds)),
    addExerciseToPlan: (planId: string, exerciseId: string, name: string, categoryId: string) =>
      data && persist(addExerciseAndAttachToPlanInData(data, planId, exerciseId, name, categoryId)),
    setExercisePhoto: (exerciseId: string, photo: string | null) => data && persist(setExercisePhotoInData(data, exerciseId, photo)),
  };

  return { data, loading, actions };
}
