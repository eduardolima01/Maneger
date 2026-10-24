import { convertFileSrc } from '@tauri-apps/api/core';
import type { KanbanCard, KanbanChecklistItem } from '@/types/kanban.types';
import { buildTasks } from '@/Kanban/utils/planTasks';
import type { TaskRow } from '@/Kanban/utils/planTasks';

/**
 * Planos acompanhados no próprio card (planTrackOnly) no calendário do kanban: em cada dia previsto do plano aparece o
 * quadrado do dia (verde/amarelo/vermelho/cinza, mesma regra do gráfico de contribuições), o título do dia e as tarefas.
 *  - mês: chip compacto (quadrado + nome + feitas/total; a lista de tarefas vai no tooltip);
 *  - semana e dia: bloco com a lista de tarefas, dá pra marcar direto ali.
 */
export type EntryColor = 'green' | 'yellow' | 'red' | 'gray';

export interface PlanEntry {
  plan: KanbanCard;
  date: string;
  tasks: TaskRow[];
  doneIds: string[];
  color: EntryColor;
  /** Título que você deu a este dia do plano ('' = sem título). */
  dayTitle: string;
}

const COLORS: Record<Exclude<EntryColor, 'gray'>, string> = { green: '#2ea043', yellow: '#f4a623', red: '#d73a49' };
const LABELS: Record<EntryColor, string> = { green: 'Todas as tarefas feitas', yellow: 'Algumas tarefas feitas', red: 'Passou sem nenhuma tarefa feita', gray: 'Nenhuma tarefa feita ainda' };

const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (k: string) => { const [y, m, d] = k.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

/** Um item por dia previsto de cada plano ATIVO em modo acompanhamento (ocorrências ficam num mapa data → itens). */
export function buildPlanEntries(plans: KanbanCard[], itemsByPlan: Map<string, KanbanChecklistItem[]>, todayKey: string): Map<string, PlanEntry[]> {
  const map = new Map<string, PlanEntry[]>();
  for (const plan of plans) {
    if (!plan.isPlanTemplate || !plan.planTrackOnly || !plan.planActive || plan.archived) continue;
    const start = plan.startDate?.slice(0, 10);
    const end = plan.dueDate?.slice(0, 10);
    if (!start || !end || start > end) continue;
    const tasks = buildTasks(itemsByPlan.get(plan.id) ?? []);
    const ids = new Set(tasks.map((t) => t.id));
    const weekdays = plan.planWeekdays.length > 0 ? plan.planWeekdays : [0, 1, 2, 3, 4, 5, 6];
    const last = parse(end);
    let guard = 0;
    for (let d = parse(start); d <= last && guard++ < 1500; d.setDate(d.getDate() + 1)) {
      if (!weekdays.includes(d.getDay())) continue;
      const date = keyOf(d);
      const doneIds = (plan.planDayChecks?.[date] ?? []).filter((id) => ids.has(id));
      const color: EntryColor = ids.size > 0 && doneIds.length >= ids.size ? 'green'
        : doneIds.length > 0 ? 'yellow'
          : ids.size > 0 && date < todayKey ? 'red' : 'gray';
      const entry: PlanEntry = { plan, date, tasks, doneIds, color, dayTitle: plan.planDayTitles?.[date] ?? '' };
      const list = map.get(date);
      if (list) list.push(entry); else map.set(date, [entry]);
    }
  }
  return map;
}

function Square({ color, size }: { color: EntryColor; size: number }) {
  return (
    <span
      className={color === 'gray' ? 'bg-neutral-300 dark:bg-neutral-600' : ''}
      style={{ width: size, height: size, borderRadius: 3, flexShrink: 0, backgroundColor: color === 'gray' ? undefined : COLORS[color] }}
    />
  );
}

/** Chip da visão de mês. */
export function PlanMonthChip({ entry, onOpen }: { entry: PlanEntry; onOpen: () => void }) {
  const { plan, tasks, doneIds, color, dayTitle } = entry;
  const tip = [
    `${plan.title}${dayTitle ? ` — ${dayTitle}` : ''}`,
    `${LABELS[color]} (${doneIds.length}/${tasks.length})`,
    ...tasks.map((t) => `${doneIds.includes(t.id) ? '☑' : '☐'} ${t.title}`),
  ].join('\n');
  return (
    <div
      onClick={onOpen}
      title={tip}
      className="bg-indigo-50 dark:bg-indigo-950 text-neutral-900 dark:text-neutral-100 border border-indigo-200 dark:border-indigo-800"
      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 5px', borderRadius: 3, cursor: 'pointer', overflow: 'hidden' }}
    >
      <Square color={color} size={9} />
      {plan.coverPath && <img src={convertFileSrc(plan.coverPath)} alt="" title="Capa do card" style={{ width: 14, height: 14, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, fontWeight: 500 }}>{dayTitle || plan.title}</span>
      <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 9, flexShrink: 0 }}>{doneIds.length}/{tasks.length}</span>
    </div>
  );
}

/** Bloco das visões de semana e de dia, com as tarefas pra marcar. */
export function PlanDetailEntry({ entry, onOpen, onToggle }: { entry: PlanEntry; onOpen: () => void; onToggle: (taskId: string) => void }) {
  const { plan, tasks, doneIds, color, dayTitle } = entry;
  const faint = 'text-neutral-500 dark:text-neutral-400';
  return (
    <div
      className="bg-indigo-50 dark:bg-indigo-950 text-neutral-900 dark:text-neutral-100 border border-indigo-200 dark:border-indigo-800"
      style={{ borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <Square color={color} size={14} />
        {plan.coverPath && <img src={convertFileSrc(plan.coverPath)} alt="" title="Capa do card" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={plan.title}>🔁 {plan.title}</span>
          {dayTitle && <span className={faint} style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dayTitle}>{dayTitle}</span>}
        </span>
        <span className={faint} style={{ fontSize: 11, flexShrink: 0 }} title={LABELS[color]}>{doneIds.length}/{tasks.length}</span>
        <button type="button" onClick={onOpen} title="Abrir o card do plano" aria-label="Abrir o card do plano" className={`${faint} bg-transparent border-0 cursor-pointer`} style={{ fontSize: 12 }}>↗</button>
      </div>
      {tasks.length === 0 && <span className={faint} style={{ fontSize: 11 }}>Plano sem tarefas — adicione itens na checklist do card.</span>}
      {tasks.map((t) => {
        const done = doneIds.includes(t.id);
        return (
          <label key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, cursor: 'pointer', paddingLeft: t.depth * 14, minWidth: 0 }}>
            <input type="checkbox" checked={done} onChange={() => onToggle(t.id)} style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ textDecoration: done ? 'line-through' : undefined, opacity: done ? 0.65 : 1, minWidth: 0, wordBreak: 'break-word' }}>{t.title}</span>
          </label>
        );
      })}
    </div>
  );
}
