import { TASK_STATUSES } from '@/types/task/status.types';
import type { StatusTaskPayload } from '@/types/task/task.types';
import type { TaskTypeComponentProps } from './taskTypeRegistry';

export default function StatusTask({ task, onUpdatePayload }: TaskTypeComponentProps) {
  const payload = task.payload as StatusTaskPayload;
  const current = TASK_STATUSES.find((s) => s.key === payload.status);

  return (
    <select
      value={payload.status}
      onChange={(e) => onUpdatePayload({ status: e.target.value } satisfies StatusTaskPayload)}
      style={{ fontSize: 12, padding: 4, borderColor: current?.color ?? '#ccc', color: current?.color ?? '#000' }}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s.key} value={s.key}>{s.label}</option>
      ))}
    </select>
  );
}
