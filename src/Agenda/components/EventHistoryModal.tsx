import { Fragment, useEffect, useState } from 'react';
import type { Event } from '@/types/event.types';
import type { ProjectType } from '@/types/project.types';
import { getEventsByProject, getEventsByRange } from '@/lib/api/events';
import {
  fromLocalISO,
  minutesSinceMidnight,
  formatMinutesLabel,
  formatDuration,
  isSameDay,
} from '@/lib/utils/date';

interface EventHistoryModalProps {
  event: Event | null;
  color: string;
  breadcrumb: ProjectType[];
  onClose: () => void;
}

interface Occurrence {
  ev: Event;
  start: Date;
  end: Date;
  minutes: number;
  dayKey: string;
  cumulative: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const norm = (s: string) => s.trim().toLowerCase();
const fmtDay = (d: Date) =>
  `${d.toLocaleDateString('pt-BR', { weekday: 'short' })}, ${d.toLocaleDateString('pt-BR')}`;
const fmtTime = (d: Date) => formatMinutesLabel(minutesSinceMidnight(d));

/**
 * Histórico do evento: todas as vezes em que ele foi colocado na agenda, com data,
 * horário, duração, total de tempo de cada dia e o acumulado.
 * "O mesmo evento" = mesmo projeto; sem projeto, mesmo título.
 */
export default function EventHistoryModal({ event, color, breadcrumb, onClose }: EventHistoryModalProps) {
  const [all, setAll] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newestFirst, setNewestFirst] = useState(true);
  const [sameTitleOnly, setSameTitleOnly] = useState(false);

  const eventId = event?.id ?? null;
  const projectId = event?.project_id ?? null;
  const title = event?.title ?? '';

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSameTitleOnly(false);
    (async () => {
      try {
        const list = projectId
          ? await getEventsByProject(projectId)
          : (await getEventsByRange('1970-01-01T00:00:00', '2999-12-31T23:59:59')).filter(
            (e) => e.project_id === null && norm(e.title) === norm(title),
          );
        if (!cancelled) setAll(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar o histórico.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, projectId, title]);

  useEffect(() => {
    if (!eventId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [eventId, onClose]);

  if (!event) return null;

  // cronológico (antigo → novo) pra calcular o acumulado; depois ordena pra exibir
  const base = (projectId && sameTitleOnly ? all.filter((e) => norm(e.title) === norm(title)) : all)
    .map((ev) => {
      const start = fromLocalISO(ev.start_at);
      const end = fromLocalISO(ev.end_at);
      return { ev, start, end, minutes: Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)), dayKey: dayKeyOf(start) };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  let running = 0;
  const occurrences: Occurrence[] = base.map((o) => {
    running += o.minutes;
    return { ...o, cumulative: running };
  });

  const dayTotals = new Map<string, { minutes: number; count: number }>();
  for (const o of occurrences) {
    const cur = dayTotals.get(o.dayKey) ?? { minutes: 0, count: 0 };
    dayTotals.set(o.dayKey, { minutes: cur.minutes + o.minutes, count: cur.count + 1 });
  }

  const shown = newestFirst ? [...occurrences].reverse() : occurrences;
  const totalMin = running;
  const dayCount = dayTotals.size;
  const first = occurrences[0]?.start;
  const last = occurrences[occurrences.length - 1]?.start;
  const showCreated = occurrences.some((o) => !!(o.ev as Event & { created_at?: string }).created_at);
  const colCount = showCreated ? 7 : 6;
  const fullPath = breadcrumb.map((p) => p.name).join(' / ');

  const th = 'px-2 py-1.5 text-left text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400';
  const td = 'px-2 py-1 text-[13px] whitespace-nowrap';

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 90 }} />
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
        className="bg-white text-gray-900 shadow-2xl dark:bg-gray-900 dark:text-gray-100 dark:ring-1 dark:ring-white/10"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 880, maxWidth: '94vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          borderRadius: 8, zIndex: 91, overflow: 'hidden',
        }}
      >
        <div style={{ borderTop: `4px solid ${color}`, padding: '12px 16px 8px', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, wordBreak: 'break-word' }}>{title}</div>
            <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: 12 }}>
              {fullPath ? `📁 ${fullPath} · ` : ''}
              {projectId ? 'todas as vezes em que este projeto foi colocado na agenda' : 'todas as vezes em que este evento (mesmo título) foi colocado na agenda'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1, alignSelf: 'flex-start' }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px 10px' }}>
          {[
            { label: 'Ocorrências', value: String(occurrences.length) },
            { label: 'Tempo total', value: formatDuration(totalMin) },
            { label: 'Dias', value: String(dayCount) },
            { label: 'Média por dia', value: dayCount ? formatDuration(Math.round(totalMin / dayCount)) : '—' },
            { label: 'Primeira vez', value: first ? first.toLocaleDateString('pt-BR') : '—' },
            { label: 'Última vez', value: last ? last.toLocaleDateString('pt-BR') : '—' },
          ].map((c) => (
            <div key={c.label} className="rounded border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800" style={{ padding: '4px 10px', minWidth: 96 }}>
              <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{c.value}</div>
            </div>
          ))}
        </div>

        <div className="border-y border-gray-200 dark:border-gray-700" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px', fontSize: 12 }}>
          <button
            type="button"
            onClick={() => setNewestFirst((v) => !v)}
            className="rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
            style={{ cursor: 'pointer', padding: '2px 8px' }}
          >
            {newestFirst ? '↓ Mais recentes primeiro' : '↑ Mais antigos primeiro'}
          </button>
          {projectId && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={sameTitleOnly} onChange={(e) => setSameTitleOnly(e.target.checked)} />
              Só com o mesmo título
            </label>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {loading ? (
            <div className="text-gray-500 dark:text-gray-400" style={{ padding: 16, fontSize: 13 }}>Carregando…</div>
          ) : error ? (
            <div className="text-red-600 dark:text-red-400" style={{ padding: 16, fontSize: 13 }}>{error}</div>
          ) : occurrences.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400" style={{ padding: 16, fontSize: 13 }}>Nenhuma ocorrência encontrada.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead className="bg-white dark:bg-gray-900" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className={th}>Data</th>
                  <th className={th}>Início</th>
                  <th className={th}>Fim</th>
                  <th className={th}>Duração</th>
                  <th className={th}>Acumulado</th>
                  <th className={th}>Evento</th>
                  {showCreated && <th className={th}>Criado em</th>}
                </tr>
              </thead>
              <tbody>
                {shown.map((o, i) => {
                  const newDay = i === 0 || shown[i - 1].dayKey !== o.dayKey;
                  const totals = dayTotals.get(o.dayKey)!;
                  const current = o.ev.id === event.id;
                  const sameDay = isSameDay(o.start, o.end);
                  const created = (o.ev as Event & { created_at?: string }).created_at;
                  return (
                    <Fragment key={o.ev.id}>
                      {newDay && (
                        <tr className="bg-gray-100 dark:bg-gray-800">
                          <td colSpan={colCount} className="px-2 py-1 text-[12px] font-semibold">
                            {fmtDay(o.start)}
                            <span className="text-gray-500 dark:text-gray-400" style={{ fontWeight: 400 }}>
                              {'  ·  '}total do dia: <b style={{ fontWeight: 700 }}>{formatDuration(totals.minutes)}</b>
                              {' · '}{totals.count} {totals.count === 1 ? 'evento' : 'eventos'}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr
                        className={`border-b border-gray-100 dark:border-gray-800 ${current ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                      >
                        <td className={td}>{o.start.toLocaleDateString('pt-BR')}</td>
                        <td className={td}>{fmtTime(o.start)}</td>
                        <td className={td}>{sameDay ? fmtTime(o.end) : `${o.end.toLocaleDateString('pt-BR')} ${fmtTime(o.end)}`}</td>
                        <td className={td}>{formatDuration(o.minutes)}</td>
                        <td className={`${td} text-gray-500 dark:text-gray-400`}>{formatDuration(o.cumulative)}</td>
                        <td className={td} style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                          {o.ev.title}{current && <span className="text-blue-600 dark:text-blue-400" style={{ fontSize: 10 }}> · este card</span>}
                        </td>
                        {showCreated && (
                          <td className={`${td} text-gray-500 dark:text-gray-400`}>
                            {created ? fromLocalISO(created).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </td>
                        )}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
