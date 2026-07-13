import type { CheckboxTaskPayload } from '@/types/task/task.types';
import type { TaskTypeComponentProps } from './taskTypeRegistry';

export default function CheckboxTask({ task, onUpdatePayload }: TaskTypeComponentProps) {
  const payload = task.payload as CheckboxTaskPayload;

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={payload.checked}
        onChange={(e) => onUpdatePayload({ checked: e.target.checked } satisfies CheckboxTaskPayload)}
      />
      {payload.checked ? 'Concluída' : 'Pendente'}
    </label>
  );
}
