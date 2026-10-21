import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadKanbanData } from '@/Kanban/api/kanbanDataStore';
import { listenKanbanChanges } from '@/Kanban/utils/kanbanSync';
import PlanDayPanel from '@/Kanban/components/PlanDayPanel';
import { buildTasks } from '@/Kanban/utils/planTasks';
import type { PlanPatch } from '@/Kanban/utils/planPersist';
import type { KanbanCard, KanbanChecklistItem } from '@/types/kanban.types';

/**
 * Acompanhamento do plano NO PRÓPRIO CARD (em vez de criar um card por ocorrência): gráfico de contribuições
 * (estilo GitHub) do início ao fim do plano + relatório de andamento.
 *
 * Cada dia guarda quais tarefas da checklist do plano foram feitas NAQUELE dia (`planDayChecks[data] = [idDaTarefa]`).
 * Cor do quadrado:  verde = todas feitas · amarelo = algumas · vermelho = dia já passou sem nenhuma · cinza = nenhuma (ainda).
 */

const GREEN = '#2ea043';
const YELLOW = '#f4a623';
const RED = '#d73a49';
const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const CELL = 13;
const GAP = 3;
/** Tempo com o mouse parado sobre um quadrado até ele ser selecionado (sem precisar clicar). */
const HOVER_SELECT_MS = 500;

type DayStatus = 'done' | 'partial' | 'missed' | 'empty';

const STATUS_COLOR: Record<DayStatus, string | null> = { done: GREEN, partial: YELLOW, missed: RED, empty: null };
const STATUS_LABEL: Record<DayStatus, string> = {
  done: 'Todas as tarefas feitas', partial: 'Algumas tarefas feitas', missed: 'Passou sem nenhuma tarefa feita', empty: 'Nenhuma tarefa feita',
};

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseKey(k: string): Date {
  const [y, m, d] = k.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtLong(k: string): string {
  const d = parseKey(k);
  return `${WEEK_LABELS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

interface DayInfo { date: string; status: DayStatus; done: number; future: boolean }

interface Props {
  card: KanbanCard;
  onUpdate: (patch: PlanPatch) => void;
  /** Dia selecionado controlado por quem usa (ex.: "Hoje" da visão Planos). Sem isso o componente guarda a seleção sozinho. */
  selected?: string | null;
  onSelect?: (date: string | null) => void;
}

export default function PlanTracker({ card, onUpdate, selected: selectedProp, onSelect }: Props) {
  const [items, setItems] = useState<KanbanChecklistItem[]>([]);
  const [selInner, setSelInner] = useState<string | null>(null);
  const selected = selectedProp !== undefined ? selectedProp : selInner;
  const setSelected = (k: string | null) => { if (onSelect) onSelect(k); else setSelInner(k); };
  const setSelectedRef = useRef(setSelected);
  setSelectedRef.current = setSelected; // o timer do hover é criado uma vez: precisa do setter mais recente
  const [report, setReport] = useState(true);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const clearHover = useCallback(() => {
    if (hoverTimer.current !== null) { window.clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    setHoverKey(null);
  }, []);
  const startHover = useCallback((k: string) => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    setHoverKey(k);
    hoverTimer.current = window.setTimeout(() => { hoverTimer.current = null; setSelectedRef.current(k); setHoverKey(null); }, HOVER_SELECT_MS);
  }, []);
  useEffect(() => () => { if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current); }, []);

  const reload = useCallback(async () => {
    try {
      const data = await loadKanbanData();
      setItems(data.checklistItems.filter((i) => i.cardId === card.id));
    } catch { /* mantém o que já tinha */ }
  }, [card.id]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => listenKanbanChanges(() => void reload()), [reload]);

  const tasks = useMemo(() => buildTasks(items), [items]);
  const taskIds = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks]);
  const checks = card.planDayChecks ?? {};
  const titles = card.planDayTitles ?? {};
  const todayKey = keyOf(new Date());
  const weekdays = card.planWeekdays.length > 0 ? card.planWeekdays : [0, 1, 2, 3, 4, 5, 6];

  const startKey = card.startDate?.slice(0, 10) ?? null;
  const endKey = card.dueDate?.slice(0, 10) ?? null;
  const validRange = !!startKey && !!endKey && startKey <= endKey;

  /** Todos os dias do plano (aplicáveis ou não) e o resultado de cada um. */
  const { days, applicable } = useMemo(() => {
    const all = new Map<string, DayInfo | null>(); // null = dia da semana fora do plano
    const list: DayInfo[] = [];
    if (!validRange) return { days: all, applicable: list };
    const end = parseKey(endKey!);
    for (let d = parseKey(startKey!); d <= end; d.setDate(d.getDate() + 1)) {
      const k = keyOf(d);
      if (!weekdays.includes(d.getDay())) { all.set(k, null); continue; }
      const done = (checks[k] ?? []).filter((id) => taskIds.has(id)).length;
      let status: DayStatus;
      if (tasks.length > 0 && done >= tasks.length) status = 'done';
      else if (done > 0) status = 'partial';
      else if (k < todayKey) status = 'missed';
      else status = 'empty';
      // sem nenhuma tarefa configurada não dá pra cobrar nada: não vira "vermelho"
      if (tasks.length === 0) status = 'empty';
      const info: DayInfo = { date: k, status, done, future: k > todayKey };
      all.set(k, info);
      list.push(info);
    }
    return { days: all, applicable: list };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validRange, startKey, endKey, weekdays.join(','), checks, tasks.length, taskIds, todayKey]);

  // ---- grade (colunas = semanas começando no domingo, linhas = dia da semana) ----
  const columns = useMemo(() => {
    if (!validRange) return [] as Array<Array<string | null>>;
    const first = parseKey(startKey!);
    first.setDate(first.getDate() - first.getDay());
    const last = parseKey(endKey!);
    const cols: Array<Array<string | null>> = [];
    for (const d = new Date(first); d <= last; d.setDate(d.getDate() + 7)) {
      const col: Array<string | null> = [];
      for (let i = 0; i < 7; i++) {
        const c = new Date(d); c.setDate(c.getDate() + i);
        const k = keyOf(c);
        col.push(k >= startKey! && k <= endKey! ? k : null);
      }
      cols.push(col);
    }
    return cols;
  }, [validRange, startKey, endKey]);

  // ---- relatório ----
  const stats = useMemo(() => {
    const evaluated = applicable.filter((d) => d.date < todayKey || (d.date === todayKey && d.done > 0));
    const count = (s: DayStatus) => applicable.filter((d) => d.status === s).length;
    const doneDays = count('done'), partialDays = count('partial'), missedDays = count('missed');
    const pendingDays = applicable.length - doneDays - partialDays - missedDays;
    const rate = evaluated.length > 0 ? Math.round((evaluated.filter((d) => d.status === 'done').length / evaluated.length) * 100) : null;
    let best = 0, run = 0;
    for (const d of evaluated) { if (d.status === 'done') { run++; best = Math.max(best, run); } else run = 0; }
    // sequência atual: dias "feitos" seguidos até o último dia avaliado (hoje vazio não quebra a sequência)
    let streak = 0;
    for (let i = evaluated.length - 1; i >= 0; i--) { if (evaluated[i].status === 'done') streak++; else break; }
    const elapsed = applicable.filter((d) => d.date <= todayKey).length;
    const progress = applicable.length > 0 ? Math.round((elapsed / applicable.length) * 100) : 0;
    // por semana (coluna): % de dias completos entre os avaliados
    const weekly = columns.map((col, i) => {
      const ds = col.map((k) => (k ? days.get(k) : null)).filter((x): x is DayInfo => !!x);
      const ev = ds.filter((d) => d.date < todayKey || (d.date === todayKey && d.done > 0));
      const pct = ev.length > 0 ? Math.round((ev.filter((d) => d.status === 'done').length / ev.length) * 100) : null;
      const label = col.find((k) => k) ?? '';
      return { i, pct, label, evaluated: ev.length };
    });
    // por tarefa: em quantos dos dias avaliados ela foi feita
    const perTask = tasks.map((t) => {
      const n = evaluated.filter((d) => (checks[d.date] ?? []).includes(t.id)).length;
      return { ...t, n, pct: evaluated.length > 0 ? Math.round((n / evaluated.length) * 100) : 0 };
    });
    return { evaluated: evaluated.length, doneDays, partialDays, missedDays, pendingDays, rate, best, streak, progress, weekly, perTask, total: applicable.length };
  }, [applicable, columns, days, tasks, checks, todayKey]);

  function setDay(date: string, ids: string[]) {
    const next = { ...checks };
    const clean = ids.filter((id) => taskIds.has(id));
    if (clean.length > 0) next[date] = clean; else delete next[date];
    onUpdate({ planDayChecks: next });
  }
  function setDayTitle(date: string, t: string) {
    const next = { ...titles };
    if (t.trim()) next[date] = t.trim(); else delete next[date];
    onUpdate({ planDayTitles: next });
  }
  function toggleTask(date: string, id: string) {
    const cur = (checks[date] ?? []).filter((x) => taskIds.has(x));
    setDay(date, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  const faint = 'text-neutral-500 dark:text-neutral-400';
  const box = 'border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900';

  if (!validRange) {
    return (
      <div className={`${box} ${faint}`} style={{ padding: 10, borderRadius: 6, fontSize: 12 }}>
        📊 Defina o <b>início</b> e o <b>fim</b> do plano (campos de data do card) para ver o gráfico de contribuições.
      </div>
    );
  }

  const sel = selected ? days.get(selected) : null;
  const selIds = selected ? (checks[selected] ?? []).filter((id) => taskIds.has(id)) : [];

  // rótulos de mês: aparece na primeira coluna em que o mês muda
  const monthLabels = columns.map((col, i) => {
    const k = col.find((x) => x);
    if (!k) return '';
    const m = parseKey(k).getMonth();
    const prev = i > 0 ? columns[i - 1].find((x) => x) : null;
    return !prev || parseKey(prev).getMonth() !== m ? MONTHS[m] : '';
  });

  return (
    <div onPointerEnter={() => void reload()} className={box} style={{ padding: 10, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>📊 Acompanhamento do plano</span>
        <button type="button" onClick={() => setReport((v) => !v)} className={`${faint} bg-transparent border-0 cursor-pointer underline`} style={{ fontSize: 11 }}>
          {report ? 'Ocultar relatório' : 'Mostrar relatório'}
        </button>
      </div>

      {tasks.length === 0 && (
        <span className="text-amber-700 dark:text-amber-300" style={{ fontSize: 11 }}>
          Este plano ainda não tem tarefas na lista de tarefas do card — adicione-as para poder marcar os dias.
        </span>
      )}

      {/* gráfico de contribuições */}
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          <div style={{ display: 'grid', gridTemplateRows: `${CELL}px repeat(7, ${CELL}px)`, gap: GAP, paddingTop: 0 }} aria-hidden>
            <span />
            {WEEK_LABELS.map((w, i) => (
              <span key={w} className={faint} style={{ fontSize: 9, lineHeight: `${CELL}px`, visibility: i % 2 === 1 ? 'visible' : 'hidden' }}>{w}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridAutoFlow: 'column', gridTemplateRows: `${CELL}px repeat(7, ${CELL}px)`, gap: GAP }}>
            {columns.map((col, ci) => (
              <ColumnCells
                key={ci} month={monthLabels[ci]} col={col} days={days} selected={selected} onSelect={setSelected} todayKey={todayKey}
                faintCls={faint} titles={titles} hoverKey={hoverKey} onHoverStart={startHover} onHoverEnd={clearHover}
              />
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11 }} className={faint}>
        {(['empty', 'partial', 'done', 'missed'] as DayStatus[]).map((s) => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <i style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLOR[s] ?? undefined, display: 'inline-block' }} className={s === 'empty' ? 'bg-neutral-200 dark:bg-neutral-700' : ''} />
            {s === 'empty' ? 'Nenhuma' : s === 'partial' ? 'Algumas' : s === 'done' ? 'Todas' : 'Passou sem nenhuma'}
          </span>
        ))}
      </div>

      {/* dia selecionado: título + tarefas */}
      {selected && sel && (
        <PlanDayPanel
          date={selected}
          tasks={tasks}
          doneIds={selIds}
          title={titles[selected] ?? ''}
          statusLabel={STATUS_LABEL[sel.status]}
          onToggle={(id) => toggleTask(selected, id)}
          onSetAll={(ids) => setDay(selected, ids)}
          onTitle={(t) => setDayTitle(selected, t)}
          onClose={() => setSelected(null)}
        />
      )}

      {/* relatório */}
      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
            <Kpi label="Andamento do plano" value={`${stats.progress}%`} sub={`${stats.total} dias no plano`} />
            <Kpi label="Dias completos" value={stats.rate == null ? '—' : `${stats.rate}%`} sub={`${stats.doneDays} de ${stats.evaluated} avaliados`} />
            <Kpi label="Sequência atual" value={`${stats.streak}`} sub={`melhor: ${stats.best} dia${stats.best === 1 ? '' : 's'}`} />
            <Kpi label="Dias perdidos" value={`${stats.missedDays}`} sub={`${stats.partialDays} parciais`} />
          </div>

          {/* distribuição */}
          <div>
            <div className={faint} style={{ fontSize: 11, marginBottom: 4 }}>Distribuição dos dias</div>
            <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden' }} className="bg-neutral-200 dark:bg-neutral-700" role="img"
              aria-label={`${stats.doneDays} completos, ${stats.partialDays} parciais, ${stats.missedDays} perdidos, ${stats.pendingDays} pendentes`}>
              {([['done', stats.doneDays, GREEN], ['partial', stats.partialDays, YELLOW], ['missed', stats.missedDays, RED]] as const).map(([k, n, c]) => (
                n > 0 ? <div key={k} title={`${STATUS_LABEL[k]}: ${n}`} style={{ width: `${(n / Math.max(1, stats.total)) * 100}%`, background: c }} /> : null
              ))}
            </div>
            <div className={faint} style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>🟩 {stats.doneDays} completos</span><span>🟨 {stats.partialDays} parciais</span><span>🟥 {stats.missedDays} perdidos</span><span>⬜ {stats.pendingDays} pendentes</span>
            </div>
          </div>

          {/* por semana */}
          {stats.weekly.length > 1 && (
            <div>
              <div className={faint} style={{ fontSize: 11, marginBottom: 4 }}>% de dias completos por semana</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70, overflowX: 'auto' }}>
                {stats.weekly.map((w) => (
                  <div key={w.i} title={w.pct == null ? `Semana de ${fmtLong(w.label)}: ainda sem dias avaliados` : `Semana de ${fmtLong(w.label)}: ${w.pct}%`}
                    style={{ width: 14, flexShrink: 0, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: w.pct == null ? 2 : `${Math.max(3, w.pct)}%`, background: w.pct == null ? undefined : w.pct >= 80 ? GREEN : w.pct >= 40 ? YELLOW : RED, borderRadius: 2 }}
                      className={w.pct == null ? 'bg-neutral-300 dark:bg-neutral-600' : ''} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* por tarefa */}
          {stats.perTask.length > 0 && (
            <div>
              <div className={faint} style={{ fontSize: 11, marginBottom: 4 }}>Quanto cada tarefa foi cumprida</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {stats.perTask.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <span style={{ flex: '0 0 38%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: t.depth * 10 }} title={t.title}>{t.title}</span>
                    <div className="bg-neutral-200 dark:bg-neutral-700" style={{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${t.pct}%`, height: '100%', background: t.pct >= 80 ? GREEN : t.pct >= 40 ? YELLOW : RED }} />
                    </div>
                    <span className={faint} style={{ width: 70, textAlign: 'right' }}>{t.pct}% ({t.n}/{stats.evaluated})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950" style={{ padding: '6px 8px', borderRadius: 6 }}>
      <div className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
      <div className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 10 }}>{sub}</div>
    </div>
  );
}

function ColumnCells({ month, col, days, selected, onSelect, todayKey, faintCls, titles, hoverKey, onHoverStart, onHoverEnd }: {
  month: string; col: Array<string | null>; days: Map<string, DayInfo | null>; selected: string | null;
  onSelect: (k: string) => void; todayKey: string; faintCls: string;
  titles: Record<string, string>; hoverKey: string | null; onHoverStart: (k: string) => void; onHoverEnd: () => void;
}) {
  return (
    <>
      <span className={faintCls} style={{ fontSize: 9, lineHeight: `${CELL}px`, whiteSpace: 'nowrap', overflow: 'visible', width: CELL }}>{month}</span>
      {col.map((k, i) => {
        if (!k) return <span key={i} style={{ width: CELL, height: CELL }} />;
        const info = days.get(k);
        if (!info) {
          // dia da semana que o plano não usa
          return <span key={i} title={`${fmtLong(k)} — fora dos dias do plano`} className="border border-dashed border-neutral-300 dark:border-neutral-700" style={{ width: CELL, height: CELL, borderRadius: 3, boxSizing: 'border-box', opacity: 0.5 }} />;
        }
        const color = STATUS_COLOR[info.status];
        return (
          <button
            key={i} type="button" onClick={() => { onHoverEnd(); onSelect(k); }}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse' && selected !== k) onHoverStart(k); }}
            onPointerLeave={onHoverEnd}
            title={`${fmtLong(k)} — ${STATUS_LABEL[info.status]}${titles[k] ? ` — ${titles[k]}` : ''}`}
            aria-label={`${fmtLong(k)}: ${STATUS_LABEL[info.status]}${titles[k] ? ` — ${titles[k]}` : ''}`}
            className={color ? 'border-0 cursor-pointer p-0' : 'bg-neutral-200 dark:bg-neutral-700 border-0 cursor-pointer p-0'}
            style={{
              width: CELL, height: CELL, borderRadius: 3, background: color ?? undefined,
              outline: selected === k ? '2px solid #6366f1' : hoverKey === k ? '2px dashed #6366f1' : k === todayKey ? '1px solid #6366f1' : 'none', outlineOffset: 1,
            }}
          />
        );
      })}
    </>
  );
}
