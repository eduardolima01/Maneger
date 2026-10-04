import { PRIORITY_LABELS } from '@/types/kanban.types';
import type { KanbanFilters as Filters, TaskPriority } from '@/types/kanban.types';
import { emptyFilters } from '@/types/kanban.types';
import type { TaskType } from '@/types/task/task.types';

interface KanbanFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  availableLabels: string[];
}

const TYPE_OPTIONS: { key: TaskType; label: string }[] = [
  { key: 'checkbox', label: '✅ Checkbox' },
  { key: 'status', label: '🚦 Status' },
  { key: 'note', label: '📝 Nota' },
];

export default function KanbanFilters({ filters, onChange, availableLabels }: KanbanFiltersProps) {
  function toggleType(t: TaskType) {
    onChange({ ...filters, types: filters.types.includes(t) ? filters.types.filter((x) => x !== t) : [...filters.types, t] });
  }
  function togglePriority(p: TaskPriority) {
    onChange({ ...filters, priorities: filters.priorities.includes(p) ? filters.priorities.filter((x) => x !== p) : [...filters.priorities, p] });
  }
  function toggleLabel(l: string) {
    onChange({ ...filters, labels: filters.labels.includes(l) ? filters.labels.filter((x) => x !== l) : [...filters.labels, l] });
  }

  return (
    <div className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.12)', padding: 12, width: 260, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, fontWeight: 600 }}>Tipo</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {TYPE_OPTIONS.map((t) => (
            <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <input type="checkbox" checked={filters.types.includes(t.key)} onChange={() => toggleType(t.key)} />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, fontWeight: 600 }}>Prioridade</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
            <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <input type="checkbox" checked={filters.priorities.includes(p)} onChange={() => togglePriority(p)} />
              {PRIORITY_LABELS[p]}
            </label>
          ))}
        </div>
      </div>

      {availableLabels.length > 0 && (
        <div>
          <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, fontWeight: 600 }}>Etiquetas</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {availableLabels.map((l) => (
              <label key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <input type="checkbox" checked={filters.labels.includes(l)} onChange={() => toggleLabel(l)} />
                {l}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, fontWeight: 600 }}>Subtarefas</span>
        <select
          value={filters.hasSubtasks === null ? '' : filters.hasSubtasks ? '1' : '0'}
          onChange={(e) => onChange({ ...filters, hasSubtasks: e.target.value === '' ? null : e.target.value === '1' })}
          className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]" style={{ width: '100%', padding: 4, fontSize: 12, marginTop: 4 }}
        >
          <option value="">Todos</option>
          <option value="1">Possui subtarefas</option>
          <option value="0">Sem subtarefas</option>
        </select>
      </div>

      <div>
        <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, fontWeight: 600 }}>Conclusão</span>
        <select
          value={filters.completion}
          onChange={(e) => onChange({ ...filters, completion: e.target.value as Filters['completion'] })}
          className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]" style={{ width: '100%', padding: 4, fontSize: 12, marginTop: 4 }}
        >
          <option value="all">Todos</option>
          <option value="done">Concluídas</option>
          <option value="pending">Pendentes</option>
        </select>
      </div>

      <button
        onClick={() => onChange(emptyFilters())}
        className="text-blue-600 dark:text-blue-400"
        style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
      >
        Limpar filtros
      </button>
    </div>
  );
}
