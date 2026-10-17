// stores/workout.store.ts
// Cada função recebe o WorkoutData atual + argumentos e devolve um NOVO
// objeto WorkoutData (sem mutar o original). Nenhuma dessas funções toca
// em React ou em modApi — é lógica de domínio pura, testável fora do app.
// O hook em hooks/useWorkoutStore.ts é quem conecta isso ao React e à
// persistência.

function addCategoryToData(data: WorkoutData, name: string): WorkoutData {
  const clean = (name || '').trim();
  if (!clean) return data;
  const cat: Category = { id: uid('cat'), name: clean, custom: true };
  return { ...data, categories: [...data.categories, cat] };
}

function addExerciseToData(data: WorkoutData, name: string, categoryId: string): WorkoutData {
  const clean = (name || '').trim();
  if (!clean || !categoryId) return data;
  const ex: Exercise = { id: uid('ex'), name: clean, categoryId, notes: '' };
  return { ...data, exercises: [...data.exercises, ex] };
}

function deleteExerciseFromData(data: WorkoutData, id: string): WorkoutData {
  return { ...data, exercises: data.exercises.filter((e) => e.id !== id) };
}

function createPlanInData(data: WorkoutData, name: string, exerciseIds: string[]): WorkoutData {
  const clean = (name || '').trim();
  if (!clean || !exerciseIds || exerciseIds.length === 0) return data;
  const plan: Plan = { id: uid('plan'), name: clean, exerciseIds };
  return { ...data, plans: [...data.plans, plan] };
}

function deletePlanFromData(data: WorkoutData, id: string): WorkoutData {
  return { ...data, plans: data.plans.filter((p) => p.id !== id) };
}

function setWeekScheduleDayInData(data: WorkoutData, dayKey: WeekDayKey, planId: string | null): WorkoutData {
  return { ...data, weekSchedule: { ...data.weekSchedule, [dayKey]: planId } };
}

function updatePlanExercisesInData(data: WorkoutData, planId: string, exerciseIds: string[]): WorkoutData {
  return {
    ...data,
    plans: data.plans.map((p) => (p.id === planId ? { ...p, exerciseIds } : p)),
  };
}

function addExerciseAndAttachToPlanInData(data: WorkoutData, planId: string, exerciseId: string, name: string, categoryId: string): WorkoutData {
  const clean = (name || '').trim();
  if (!clean || !categoryId) return data;
  const ex: Exercise = { id: exerciseId, name: clean, categoryId, notes: '' };
  const plans = data.plans.map((p) => (p.id === planId ? { ...p, exerciseIds: [...p.exerciseIds, ex.id] } : p));
  return { ...data, exercises: [...data.exercises, ex], plans };
}

function setExercisePhotoInData(data: WorkoutData, exerciseId: string, photo: string | null): WorkoutData {
  return {
    ...data,
    exercises: data.exercises.map((e) => (e.id === exerciseId ? { ...e, photo } : e)),
  };
}
