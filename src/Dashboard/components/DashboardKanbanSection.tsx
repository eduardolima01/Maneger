import { useEffect, useState } from 'react';
import { getAllKanbansWithProject } from '@/lib/api/kanban/kanbans';
import type { Kanban } from '@/types/kanban.types';
// TODO: confirmar caminho real (assumido a partir de GlobalKanbanModalHost.tsx estar em '@/Kanban/')
import { openGlobalKanbanModal } from '@/Kanban/globalKanbanModal';
import { recordKanbanOpened } from '../recentActivity';

// getAllKanbansWithProject() retorna um shape mais rico (não exportado em kanbans.ts);
// este tipo só declara o subconjunto que esta seção realmente usa.
interface KanbanWithProjectLite extends Kanban {
  projectName: string;
}

interface DashboardKanbanSectionProps {
  refreshKey?: number;
}

export default function DashboardKanbanSection({ refreshKey }: DashboardKanbanSectionProps) {
  const [kanbans, setKanbans] = useState<KanbanWithProjectLite[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAllKanbansWithProject().then((data) => {
      if (!cancelled) setKanbans(data);
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Kanban</h2>

      {kanbans === null && <p style={{ fontSize: 13, color: '#999' }}>Carregando...</p>}

      {kanbans !== null && kanbans.length === 0 && (
        <p style={{ fontSize: 13, color: '#999' }}>Nenhum Kanban disponível.</p>
      )}

      {kanbans !== null && kanbans.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {kanbans.map((k) => (
            <div
              key={k.id}
              onClick={() => {
                recordKanbanOpened({ id: k.id, name: k.name, projectId: k.projectId, projectName: k.projectName });
                openGlobalKanbanModal(k);
              }}
              style={{
                border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px',
                cursor: 'pointer', backgroundColor: '#fff',
              }}
              className="hover:shadow-sm"
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>📋 {k.name}</div>
              <div style={{ fontSize: 12, color: '#999' }}>{k.projectName}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
