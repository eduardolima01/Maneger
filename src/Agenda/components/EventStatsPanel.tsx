import { useEffect } from 'react';
import type { Event } from '@/types/event.types';
import { ProjectType } from '@/types/project.types';
import { formatDuration } from '@/lib/utils/date';
import { useEventStatsPanel } from './Useeventstatspanel';

interface EventStatsPanelProps {
  event: Event | null;
  onClose: () => void;
  resolveColor: (projectId: string | null) => string;
  resolveBreadcrumb: (projectId: string | null) => ProjectType[];
}

/**
 * Convenção de cor reaproveitada da descrição do WeekComparisonModal (verde
 * = semana comparada teve mais horas, vermelho = teve menos, sempre relativo
 * à semana de referência). Reimplementada aqui porque o código real do
 * WeekComparisonModal nunca foi lido nesta conversa — pode valer a pena
 * unificar depois se os dois arquivos forem revisados juntos.
 */
function formatDiff(comparedMinutes: number, referenceMinutes: number): { text: string; color: string } {
  const diff = comparedMinutes - referenceMinutes;
  const color = diff >= 0 ? '#1e8e3e' : '#d93025';

  if (referenceMinutes === 0) {
    if (diff === 0) return { text: '—', color: '#666' };
    const sign = diff > 0 ? '+' : '-';
    return { text: `${sign}${formatDuration(Math.abs(diff))}`, color };
  }

  const pct = Math.round((diff / referenceMinutes) * 100);
  const sign = pct >= 0 ? '+' : '';
  return { text: `${sign}${pct}%`, color };
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

export default function EventStatsPanel({ event, onClose, resolveColor, resolveBreadcrumb }: EventStatsPanelProps) {
  const isOpen = event !== null;
  const { data, loading } = useEventStatsPanel(event);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const breadcrumb = event ? resolveBreadcrumb(event.project_id) : [];
  const projectName = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].name : null;
  const color = event ? resolveColor(event.project_id) : '#1a73e8';

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.15)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 150ms ease',
          zIndex: 40,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 320,
          maxWidth: '90vw',
          backgroundColor: '#fff',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.15)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 200ms ease',
          zIndex: 41,
          display: 'flex',
          flexDirection: 'column',
          padding: 20,
          overflowY: 'auto',
        }}
      >
        {event && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{projectName ?? 'Sem projeto'}</span>
                </div>
                <div style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {event.title}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#888', lineHeight: 1, flexShrink: 0 }}
              >
                ×
              </button>
            </div>

            {!projectName ? (
              <div style={{ fontSize: 13, color: '#888' }}>
                Este evento não está atribuído a um projeto — não há estatísticas de projeto pra mostrar.
              </div>
            ) : loading || !data ? (
              <div style={{ fontSize: 13, color: '#888' }}>Carregando…</div>
            ) : (
              <>
                <StatRow label="Nesta semana" value={formatDuration(data.weekMinutes)} />
                <StatRow label={`Em ${data.monthLabel}`} value={formatDuration(data.monthMinutes)} />
                <StatRow label="Média diária no mês" value={formatDuration(Math.round(data.dailyAverageMinutes))} />

                <div style={{ marginTop: 20, marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#666' }}>
                  Comparação com semanas anteriores
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {data.previousWeeks.map((w) => {
                    const diff = formatDiff(w.minutes, data.weekMinutes);
                    return (
                      <div
                        key={w.offset}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}
                      >
                        <span style={{ color: '#666' }}>{w.offset} semana{w.offset !== -1 ? 's' : ''}</span>
                        <span>{formatDuration(w.minutes)}</span>
                        <span style={{ color: diff.color, fontWeight: 600, minWidth: 52, textAlign: 'right' }}>{diff.text}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: '#aaa' }}>
                  Comparação sempre relativa à semana deste evento (não necessariamente a semana atual).
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
