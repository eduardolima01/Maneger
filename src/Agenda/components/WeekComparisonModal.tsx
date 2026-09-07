import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import type { Event } from '@/types/event.types';
import type { ProjectType } from '@/types/project.types';
import { addDays, fromLocalISO, isSameDay, minutesSinceMidnight, formatDuration } from '@/lib/utils/date';
import { useWeekComparisonEvents } from '../hooks/useWeekComparisonEvents';

interface WeekComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekStart: Date;
  days: Date[];
  currentWeekEvents: Event[];
  resolveColor: (projectId: string | null) => string;
  resolveBreadcrumb: (projectId: string | null) => ProjectType[];
}

const OFFSET_OPTIONS = [-1, -2, -3, -4];
const ROW_HEIGHT = 44;
const VB_W = 500;
const LABEL_COL_WIDTH = 170;
const DISABLED_PROJECTS_STORAGE_KEY = 'week-comparison-disabled-projects';

const DIFF_UP_COLOR = '#1e8e3e';   // verde: semana comparada teve MAIS horas que a atual
const DIFF_DOWN_COLOR = '#d93025'; // vermelho: semana comparada teve MENOS horas que a atual

function loadDisabledProjects(): Set<string> {
  try {
    const raw = localStorage.getItem(DISABLED_PROJECTS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function saveDisabledProjects(disabled: Set<string>) {
  try {
    localStorage.setItem(DISABLED_PROJECTS_STORAGE_KEY, JSON.stringify([...disabled]));
  } catch {
    // localStorage indisponível -> falha silenciosa, preferência não persiste nessa sessão
  }
}

function getWeekStyle(offset: number): { dash?: string; opacity: number } {
  switch (offset) {
    case 0: return { dash: undefined, opacity: 1 };
    case -1: return { dash: '6 4', opacity: 0.85 };
    case -2: return { dash: '2 4', opacity: 0.65 };
    case -3: return { dash: '8 3 2 3', opacity: 0.5 };
    default: return { dash: '3 6', opacity: 0.4 };
  }
}

function weekLabel(offset: number): string {
  return offset === 0 ? 'Esta semana' : offset === -1 ? 'Semana passada' : `${-offset} semanas atrás`;
}

function computeDayMinutesByProject(events: Event[], day: Date): Record<string, number> {
  const result: Record<string, number> = {};
  for (const ev of events) {
    const start = fromLocalISO(ev.start_at);
    if (!isSameDay(start, day)) continue;
    const end = fromLocalISO(ev.end_at);
    const startMin = minutesSinceMidnight(start);
    const spansMidnight = !isSameDay(start, end);
    const durationMin = spansMidnight
      ? (24 * 60 - startMin) + minutesSinceMidnight(end)
      : minutesSinceMidnight(end) - startMin;
    const key = ev.project_id ?? '__none__';
    result[key] = (result[key] ?? 0) + durationMin;
  }
  return result;
}

// Formata a diferença de uma semana comparada em relação à semana atual.
// Retorna null quando não há nada a mostrar (ambas em zero).
function formatDiff(currentMinutes: number, comparedMinutes: number): { text: string; color: string } | null {
  const diff = comparedMinutes - currentMinutes;
  if (diff === 0) {
    if (currentMinutes === 0) return null; // 0 vs 0 -> nada a comparar
    return { text: '±0%', color: '#888' };
  }
  const color = diff > 0 ? DIFF_UP_COLOR : DIFF_DOWN_COLOR;
  const sign = diff > 0 ? '+' : '−';
  if (currentMinutes === 0) {
    // percentual indefinido (divisão por zero) -> mostra só o tempo absoluto
    return { text: `${sign}${formatDuration(Math.abs(diff))}`, color };
  }
  const pct = Math.round((diff / currentMinutes) * 100);
  return { text: `${sign}${Math.abs(pct)}%`, color };
}

type LinePoint = { x: number; y: number } | null;

export default function WeekComparisonModal({
  isOpen, onClose, weekStart, days, currentWeekEvents, resolveColor, resolveBreadcrumb,
}: WeekComparisonModalProps) {
  const [selectedOffsets, setSelectedOffsets] = useState<number[]>([-1]);
  const [disabledProjects, setDisabledProjects] = useState<Set<string>>(() => loadDisabledProjects());
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  useEffect(() => {
    saveDisabledProjects(disabledProjects);
  }, [disabledProjects]);

  const { dataByOffset } = useWeekComparisonEvents(weekStart, isOpen ? selectedOffsets : []);

  const eventsByOffset: Record<number, Event[]> = { 0: currentWeekEvents, ...dataByOffset };
  const activeOffsets = [0, ...selectedOffsets].filter((o) => eventsByOffset[o] !== undefined);

  const matrix: Record<number, Record<string, number>[]> = {};
  for (const offset of activeOffsets) {
    const evs = eventsByOffset[offset];
    matrix[offset] = days.map((_, i) => {
      const day = addDays(weekStart, offset * 7 + i);
      return computeDayMinutesByProject(evs, day);
    });
  }

  const projectKeys = new Set<string>();
  for (const offset of activeOffsets) {
    for (const dayMap of matrix[offset]) {
      for (const key of Object.keys(dayMap)) projectKeys.add(key);
    }
  }
  const projectList = Array.from(projectKeys)
    .map((key) => {
      const projectId = key === '__none__' ? null : key;
      const breadcrumb = resolveBreadcrumb(projectId);
      const label = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].name : 'Sem projeto';
      const currentWeekTotal = matrix[0]?.reduce((sum, dayMap) => sum + (dayMap[key] ?? 0), 0) ?? 0;
      return { key, projectId, label, color: resolveColor(projectId), currentWeekTotal };
    })
    .sort((a, b) => b.currentWeekTotal - a.currentWeekTotal);

  const visibleProjects = projectList.filter((p) => !disabledProjects.has(p.key));

  const xPos = (dayIndex: number) => ((dayIndex + 0.5) / 7) * VB_W;

  function pointsToSegments(points: LinePoint[], yPos: (h: number) => number): { x: number; y: number }[][] {
    const segments: { x: number; y: number }[][] = [];
    let current: { x: number; y: number }[] = [];
    for (const p of points) {
      if (p === null) {
        if (current.length > 0) segments.push(current);
        current = [];
      } else {
        current.push({ x: xPos(p.x), y: yPos(p.y) });
      }
    }
    if (current.length > 0) segments.push(current);
    return segments;
  }

  function isLoadingOffset(offset: number): boolean {
    return offset !== 0 && selectedOffsets.includes(offset) && dataByOffset[offset] === undefined;
  }

  // Tooltip: pra cada semana ativa, total do dia + detalhamento por projeto,
  // cada um com a diferença em relação à semana atual (offset 0) já calculada.
  function buildTooltipRows(dayIndex: number) {
    const currentDayMap = matrix[0][dayIndex];
    const currentTotal = visibleProjects.reduce((sum, p) => sum + (currentDayMap[p.key] ?? 0), 0);

    return activeOffsets.map((offset) => {
      const dayMap = matrix[offset][dayIndex];
      const breakdown = visibleProjects
        .filter((p) => dayMap[p.key] !== undefined)
        .map((p) => ({
          label: p.label,
          color: p.color,
          minutes: dayMap[p.key],
          diff: offset === 0 ? null : formatDiff(currentDayMap[p.key] ?? 0, dayMap[p.key]),
        }));
      const total = breakdown.reduce((sum, b) => sum + b.minutes, 0);
      const totalDiff = offset === 0 ? null : formatDiff(currentTotal, total);
      return { offset, total, totalDiff, breakdown };
    });
  }

  const hasAnyData = visibleProjects.some((p) =>
    activeOffsets.some((offset) => matrix[offset].some((dayMap) => dayMap[p.key] !== undefined))
  );

  const allProjectsDisabled = projectList.length > 0 && projectList.every((p) => disabledProjects.has(p.key));

  return (
    <Modal open={isOpen} onClose={onClose} title="Comparativo de horas por semana">
      <div style={{ padding: 16, width: 700, maxWidth: '90vw', maxHeight: '75vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {OFFSET_OPTIONS.map((offset) => {
            const start = addDays(weekStart, offset * 7);
            const end = addDays(start, 6);
            const rangeLabel = `${start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}–${end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`;
            const checked = selectedOffsets.includes(offset);
            const style = getWeekStyle(offset);
            return (
              <label
                key={offset}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555',
                  padding: '3px 8px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer',
                  backgroundColor: checked ? '#eef2f7' : '#fff',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setSelectedOffsets((prev) => checked ? prev.filter((o) => o !== offset) : [...prev, offset])}
                  style={{ margin: 0 }}
                />
                <svg width="20" height="8" style={{ flexShrink: 0 }}>
                  <line x1={0} y1={4} x2={20} y2={4} stroke="#666" strokeWidth={2} strokeDasharray={style.dash} opacity={style.opacity} />
                </svg>
                {weekLabel(offset)} ({rangeLabel}){isLoadingOffset(offset) ? ' ⏳' : ''}
              </label>
            );
          })}
        </div>

        {!hasAnyData ? (
          <p style={{ fontSize: 13, color: '#999', textAlign: 'center', padding: '24px 0' }}>
            {allProjectsDisabled
              ? 'Todos os projetos estão ocultos. Marque algum na lista abaixo pra ver o comparativo.'
              : 'Sem dados suficientes pra comparar ainda.'}
          </p>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', marginBottom: 4 }}>
              <div style={{ width: LABEL_COL_WIDTH, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex' }}>
                {days.map((day, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#999' }}>
                    {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {visibleProjects.map((project) => {
                const rowMax = Math.max(
                  1,
                  ...activeOffsets.flatMap((offset) =>
                    matrix[offset].map((dayMap) => dayMap[project.key] ?? 0).map((m) => m / 60)
                  )
                );
                const yPos = (hours: number) => ROW_HEIGHT - 4 - (hours / rowMax) * (ROW_HEIGHT - 8);

                return (
                  <div key={project.key} style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid #f2f2f2' }}>
                    <div style={{ width: LABEL_COL_WIDTH, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: project.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#666', flexShrink: 0 }}>
                        {project.currentWeekTotal > 0 ? formatDuration(project.currentWeekTotal) : '—'}
                      </span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <svg
                        viewBox={`0 0 ${VB_W} ${ROW_HEIGHT}`}
                        preserveAspectRatio="none"
                        style={{ width: '100%', height: ROW_HEIGHT, display: 'block' }}
                      >
                        <line x1={0} x2={VB_W} y1={ROW_HEIGHT - 4} y2={ROW_HEIGHT - 4} stroke="#f0f0f0" />

                        {activeOffsets.map((offset) => {
                          const style = getWeekStyle(offset);
                          const points: LinePoint[] = matrix[offset].map((dayMap, i) => {
                            const minutes = dayMap[project.key];
                            if (minutes === undefined) return null;
                            return { x: i, y: minutes / 60 };
                          });
                          if (!points.some((p) => p !== null)) return null;

                          return pointsToSegments(points, yPos).map((seg, segIdx) => (
                            <g key={`${offset}-${segIdx}`}>
                              <polyline
                                points={seg.map((p) => `${p.x},${p.y}`).join(' ')}
                                fill="none"
                                stroke={project.color}
                                strokeWidth={2}
                                strokeDasharray={style.dash}
                                opacity={style.opacity}
                                vectorEffect="non-scaling-stroke"
                              />
                              {seg.map((p, pIdx) => (
                                <circle key={pIdx} cx={p.x} cy={p.y} r={2.5} fill={project.color} opacity={style.opacity} vectorEffect="non-scaling-stroke" />
                              ))}
                            </g>
                          ));
                        })}

                        {hoveredDayIndex !== null && (
                          <rect x={(hoveredDayIndex / 7) * VB_W} y={0} width={VB_W / 7} height={ROW_HEIGHT} fill="rgba(26,115,232,0.05)" />
                        )}
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ position: 'absolute', top: 20, left: LABEL_COL_WIDTH, right: 0, bottom: 0, display: 'flex' }}>
              {days.map((_, i) => (
                <div
                  key={i}
                  style={{ flex: 1 }}
                  onMouseEnter={() => setHoveredDayIndex(i)}
                  onMouseLeave={() => setHoveredDayIndex((cur) => (cur === i ? null : cur))}
                />
              ))}
            </div>

            {hoveredDayIndex !== null && (
              <div
                style={{
                  position: 'absolute',
                  top: 20,
                  left: `calc(${LABEL_COL_WIDTH}px + ${((hoveredDayIndex + 0.5) / 7) * 100}% - ${LABEL_COL_WIDTH * ((hoveredDayIndex + 0.5) / 7)}px)`,
                  transform:
                    hoveredDayIndex === 0 ? 'translateX(0)'
                      : hoveredDayIndex === days.length - 1 ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                  pointerEvents: 'none',
                  backgroundColor: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  padding: '6px 8px',
                  fontSize: 11,
                  color: '#333',
                  zIndex: 10,
                  minWidth: 190,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4, textTransform: 'capitalize' }}>
                  {days[hoveredDayIndex].toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
                </div>
                {buildTooltipRows(hoveredDayIndex).map(({ offset, total, totalDiff, breakdown }) => (
                  <div key={offset} style={{ marginBottom: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, gap: 6 }}>
                      <span>{weekLabel(offset)}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {total > 0 ? formatDuration(total) : '—'}
                        {totalDiff && <span style={{ fontWeight: 700, color: totalDiff.color }}>{totalDiff.text}</span>}
                      </span>
                    </div>
                    {breakdown.map((b) => (
                      <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4, color: '#666' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: b.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {formatDuration(b.minutes)}
                          {b.diff && <span style={{ fontWeight: 700, color: b.diff.color }}>{b.diff.text}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* filtro de projeto: liga/desliga quais linhas aparecem acima */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {projectList.length > 0 && (
            <button
              onClick={() => {
                setDisabledProjects(allProjectsDisabled ? new Set() : new Set(projectList.map((p) => p.key)));
              }}
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #ddd',
                cursor: 'pointer', backgroundColor: '#fff', color: '#555',
              }}
            >
              {allProjectsDisabled ? 'Marcar todos' : 'Desmarcar todos'}
            </button>
          )}
          {projectList.map((project) => {
            const disabled = disabledProjects.has(project.key);
            return (
              <button
                key={project.key}
                onClick={() => {
                  setDisabledProjects((prev) => {
                    const next = new Set(prev);
                    if (next.has(project.key)) next.delete(project.key);
                    else next.add(project.key);
                    return next;
                  });
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                  padding: '2px 6px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer',
                  backgroundColor: disabled ? '#f5f5f5' : '#fff',
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: project.color, flexShrink: 0 }} />
                {project.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: 12 }}>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}
