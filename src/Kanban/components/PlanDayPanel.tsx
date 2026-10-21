import { useEffect, useState } from 'react';
import type { TaskRow } from '@/Kanban/utils/planTasks';
import { fmtLongDate } from '@/Kanban/utils/planToday';

/**
 * Painel de UM dia do plano: título do quadrado (opcional) + as tarefas do plano pra marcar o que foi feito naquele dia.
 * Usado no gráfico de contribuições (dia selecionado) e no "Hoje" da visão Planos.
 */
export default function PlanDayPanel({ date, tasks, doneIds, title, statusLabel, onToggle, onSetAll, onTitle, onClose }: {
  date: string;
  tasks: TaskRow[];
  doneIds: string[];
  title: string;
  statusLabel: string;
  onToggle: (taskId: string) => void;
  onSetAll: (ids: string[]) => void;
  onTitle: (title: string) => void;
  onClose?: () => void;
}) {
  const [draft, setDraft] = useState(title);
  useEffect(() => { setDraft(title); }, [title, date]);

  const faint = 'text-neutral-500 dark:text-neutral-400';
  const link = 'bg-transparent border-0 cursor-pointer underline';

  function commitTitle() {
    if (draft.trim() !== title) onTitle(draft.trim());
  }

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950" style={{ padding: 8, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 12 }}>{fmtLongDate(date)}</b>
        <span className={faint} style={{ fontSize: 11 }}>{doneIds.length}/{tasks.length} tarefas · {statusLabel}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => onSetAll(tasks.map((t) => t.id))} className={`${link} text-indigo-700 dark:text-indigo-300`} style={{ fontSize: 11 }}>Marcar todas</button>
        <button type="button" onClick={() => onSetAll([])} className={`${link} ${faint}`} style={{ fontSize: 11 }}>Limpar</button>
        {onClose && <button type="button" onClick={onClose} aria-label="Fechar" className={`${faint} bg-transparent border-0 cursor-pointer`} style={{ fontSize: 12 }}>✕</button>}
      </div>

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setDraft(title); (e.target as HTMLInputElement).blur(); }
        }}
        placeholder="Título deste dia (opcional) — ex.: Treino de perna"
        aria-label="Título do dia"
        maxLength={80}
        className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600"
        style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, width: '100%', boxSizing: 'border-box' }}
      />

      {tasks.length === 0 && <span className={faint} style={{ fontSize: 11 }}>Sem tarefas configuradas.</span>}
      {tasks.map((t) => (
        <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', paddingLeft: t.depth * 16 }}>
          <input type="checkbox" checked={doneIds.includes(t.id)} onChange={() => onToggle(t.id)} />
          <span style={{ textDecoration: doneIds.includes(t.id) ? 'line-through' : undefined, opacity: doneIds.includes(t.id) ? 0.65 : 1 }}>{t.title}</span>
        </label>
      ))}
    </div>
  );
}
