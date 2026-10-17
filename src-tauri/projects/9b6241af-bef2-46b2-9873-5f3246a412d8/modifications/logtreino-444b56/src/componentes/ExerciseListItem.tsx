// componentes/ExerciseListItem.tsx
function ExerciseListItem({ React, s, exercise, onOpen, onDelete, onSetPhoto }: any) {
  return (
    <div style={s.cardAlt}>
      <div style={{ ...s.row, justifyContent: 'space-between' }}>
        <span style={s.link} onClick={() => onOpen(exercise.id)}>{exercise.name}</span>
        <button style={s.btnDanger} onClick={() => onDelete(exercise.id)}>remover</button>
      </div>
      <ExercisePhotoField React={React} s={s} exercise={exercise} onSetPhoto={onSetPhoto} size={40} />
    </div>
  );
}
