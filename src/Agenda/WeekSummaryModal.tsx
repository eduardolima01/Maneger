import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import { convertFileSrc } from '@tauri-apps/api/core';
import { formatDuration } from '../lib/utils/date';

interface ProjectSummaryEntry {
  projectId: string | null;
  label: string;
  minutes: number;
}

interface WeekSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventCount: number;
  totalMinutes: number;
  byProject: ProjectSummaryEntry[];
  resolveCover: (projectId: string | null) => string | null;
  resolveColor: (projectId: string | null) => string;
}

export default function WeekSummaryModal({
  isOpen, onClose, eventCount, totalMinutes, byProject, resolveCover, resolveColor,
}: WeekSummaryModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose} title="Resumo da semana">
      <div style={{ padding: 16, width: 380, maxWidth: '90vw', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, color: '#666' }}>
            {eventCount} evento{eventCount !== 1 ? 's' : ''} nesta semana
          </span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1a73e8' }}>
            {totalMinutes > 0 ? formatDuration(totalMinutes) : '—'}
          </span>
        </div>

        {byProject.length === 0 ? (
          <p style={{ fontSize: 13, color: '#999' }}>Nenhum evento nesta semana.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byProject.map((p) => {
              const cover = resolveCover(p.projectId);
              const color = resolveColor(p.projectId);
              const pct = totalMinutes > 0 ? Math.round((p.minutes / totalMinutes) * 100) : 0;
              return (
                <div key={p.projectId ?? '__none__'} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {cover ? (
                      <img src={convertFileSrc(cover)} className="w-6 h-6 rounded-full object-cover shrink-0" />
                    ) : (
                      <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                    )}
                    <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a73e8', flexShrink: 0 }}>{formatDuration(p.minutes)}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, backgroundColor: '#eee', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: 12 }}>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}
