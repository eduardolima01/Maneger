import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
// TODO: confirmar caminhos reais
import Modal from '@/components/ui/Modal';
import type { Event } from '@/types/event.types';
import type { ProjectType } from '@/types/project.types';
import { getEventsByRange } from '@/lib/api/events';

const WEEK_OPTIONS = [4, 8, 12, 26];
const PALETTE = ['#1a73e8', '#e8710a', '#0f9d58', '#a142f4', '#d93025', '#12b5cb', '#f4b400', '#795548'];

interface WeekBucket {
  weekStart: Date;
  weekEnd: Date;
  label: string;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // segunda-feira como início da semana
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildLastWeeks(count: number): WeekBucket[] {
  const currentWeekStart = startOfWeek(new Date());
  const weeks: WeekBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
    weeks.push({ weekStart, weekEnd, label });
  }
  return weeks;
}

function durationHours(startISO: string, endISO: string): number {
  return Math.max(0, (new Date(endISO).getTime() - new Date(startISO).getTime()) / 3600000);
}

interface ProjectTimeChartProps {
  projects: ProjectType[];
}

function SortedTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const sorted = [...payload]
    .filter((p) => Number(p.value) > 0)
    .sort((a, b) => Number(b.value) - Number(a.value));

  if (sorted.length === 0) return null;

  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
      padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {sorted.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.color, display: 'inline-block' }} />
          <span>{p.name}: {Number(p.value).toFixed(1)}h</span>
        </div>
      ))}
    </div>
  );
}

export default function ProjectTimeChart({ projects }: ProjectTimeChartProps) {
  const [weekCount, setWeekCount] = useState(8);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set()); // vazio = todos
  const [events, setEvents] = useState<Event[] | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<WeekBucket | null>(null);

  const weeks = useMemo(() => buildLastWeeks(weekCount), [weekCount]);

  useEffect(() => {
    let cancelled = false;
    const rangeStartISO = weeks[0].weekStart.toISOString();
    const rangeEndISO = weeks[weeks.length - 1].weekEnd.toISOString();
    getEventsByRange(rangeStartISO, rangeEndISO).then((data) => {
      if (!cancelled) setEvents(data);
    });
    return () => { cancelled = true; };
  }, [weeks]);

  function toggleProject(id: string) {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const activeProjects = selectedProjectIds.size === 0
    ? projects
    : projects.filter((p) => selectedProjectIds.has(p.id));

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => e.project_id && (selectedProjectIds.size === 0 || selectedProjectIds.has(e.project_id)));
  }, [events, selectedProjectIds]);

  const chartData = useMemo(() => {
    return weeks.map((w) => {
      const row: Record<string, number | string> = { week: w.label };
      for (const p of activeProjects) row[p.id] = 0;
      for (const ev of filteredEvents) {
        const start = new Date(ev.start_at);
        if (ev.project_id && start >= w.weekStart && start < w.weekEnd) {
          row[ev.project_id] = Number(row[ev.project_id] ?? 0) + durationHours(ev.start_at, ev.end_at);
        }
      }
      return row;
    });
  }, [weeks, activeProjects, filteredEvents]);

  const weekEvents = useMemo(() => {
    if (!selectedWeek) return [];
    return filteredEvents
      .filter((e) => {
        const start = new Date(e.start_at);
        return start >= selectedWeek.weekStart && start < selectedWeek.weekEnd;
      })
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
  }, [selectedWeek, filteredEvents]);

  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  // total de horas de cada projeto no período exibido, pra ordenar do maior pro menor
  const totalsByProject = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of chartData) {
      for (const p of activeProjects) {
        const v = Number(row[p.id] ?? 0);
        totals.set(p.id, (totals.get(p.id) ?? 0) + v);
      }
    }
    return totals;
  }, [chartData, activeProjects]);

  const projectsWithColor = [...activeProjects]
    .sort((a, b) => (totalsByProject.get(b.id) ?? 0) - (totalsByProject.get(a.id) ?? 0))
    .map((p, i) => ({ ...p, chartColor: p.color || PALETTE[i % PALETTE.length] }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Tempo por Projeto</h2>

        <div style={{ display: 'flex', gap: 6 }}>
          {WEEK_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setWeekCount(n)}
              style={{
                border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', fontSize: 12,
                cursor: 'pointer', background: weekCount === n ? '#1a73e8' : '#fff',
                color: weekCount === n ? '#fff' : '#444',
              }}
            >
              {n} sem.
            </button>
          ))}
        </div>
      </div>

      {projects.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {projects.map((p) => {
            const active = selectedProjectIds.size === 0 || selectedProjectIds.has(p.id);
            return (
              <span
                key={p.id}
                onClick={() => toggleProject(p.id)}
                style={{
                  fontSize: 12, padding: '3px 10px', borderRadius: 12, cursor: 'pointer',
                  border: `1px solid ${p.color || '#1a73e8'}`,
                  backgroundColor: active ? (p.color || '#1a73e8') : '#fff',
                  color: active ? '#fff' : (p.color || '#1a73e8'),
                }}
              >
                {p.name}
              </span>
            );
          })}
        </div>
      )}

      {events === null && <p style={{ fontSize: 13, color: '#999' }}>Carregando...</p>}

      {events !== null && activeProjects.length === 0 && (
        <p style={{ fontSize: 13, color: '#999' }}>Nenhum projeto selecionado.</p>
      )}

      {events !== null && activeProjects.length > 0 && (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              onClick={(state) => {
                if (!state || !state.activeLabel) return;
                const week = weeks.find((w) => w.label === state.activeLabel);
                if (week) setSelectedWeek(week);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" fontSize={12} />
              <YAxis fontSize={12} label={{ value: 'horas', angle: -90, position: 'insideLeft', fontSize: 12 }} />
              <Tooltip content={<SortedTooltip />} />
              <Legend />
              {projectsWithColor.map((p) => (
                <Bar key={p.id} dataKey={p.id} name={p.name} stackId="a" fill={p.chartColor} style={{ cursor: 'pointer' }} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <Modal
        open={selectedWeek !== null}
        onClose={() => setSelectedWeek(null)}
        title={selectedWeek ? `Semana de ${selectedWeek.label}` : ''}
      >
        <div style={{ padding: 16, maxHeight: 360, overflowY: 'auto' }}>
          {weekEvents.length === 0 && (
            <p style={{ fontSize: 13, color: '#999' }}>Nenhum evento nessa semana.</p>
          )}
          {weekEvents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {weekEvents.map((e) => (
                <div key={e.id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {e.project_id ? projectNameById.get(e.project_id) ?? 'Projeto' : ''}
                    {' · '}{durationHours(e.start_at, e.end_at).toFixed(1)}h
                    {' · '}{new Date(e.start_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
