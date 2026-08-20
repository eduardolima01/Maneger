import { useState } from 'react';
import { marked } from 'marked';
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu'; // TODO: confirmar caminho real
// TODO: confirmar caminho real de useProjects (usado hoje em outros pontos do app)
import { openEntityTab } from '@/components/layout/tabs/tabStore';
import MomentAttachments from './MomentAttachments';
import type { Moment } from '../types/feed.types';
import { useProjects } from '@/lib/hooks/useProjects';

interface MomentCardProps {
  moment: Moment;
  highlighted?: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveDate: () => void;
}

export default function MomentCard({ moment, highlighted, onEdit, onDuplicate, onDelete, onMoveDate }: MomentCardProps) {
  const { projects } = useProjects();
  const project = moment.projectId ? projects.find((p) => p.id === moment.projectId) : null;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const time = new Date(moment.occurredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const items: ContextMenuItem[] = [
    { label: 'Editar', onClick: onEdit },
    { label: 'Duplicar', onClick: onDuplicate },
    { label: 'Mover data', onClick: onMoveDate },
    { label: 'Copiar', onClick: () => navigator.clipboard.writeText(moment.content) },
    { label: 'Excluir', danger: true, onClick: onDelete },
  ];

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#999', width: 44, flexShrink: 0, paddingTop: 12, textAlign: 'right' }}>{time}</div>

      <div
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
        style={{
          flex: 1, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff',
          outline: highlighted ? '2px solid #1a73e8' : 'none',
        }}
      >
        <div
          style={{ fontSize: 14, lineHeight: 1.5 }}
          dangerouslySetInnerHTML={{ __html: marked.parse(moment.content, { async: false }) as string }}
        />

        <MomentAttachments attachments={moment.attachments} />

        {(moment.tags.length > 0 || project) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {project && (
              <span
                onClick={() => openEntityTab(`/projects/${project.id}`)}
                style={{ fontSize: 12, color: '#1a73e8', cursor: 'pointer', fontWeight: 500 }}
              >
                📁 {project.name}
              </span>
            )}
            {moment.tags.map((t) => (
              <span key={t} style={{ fontSize: 12, color: '#999' }}>#{t}</span>
            ))}
          </div>
        )}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={items} onClose={() => setMenu(null)} />}
    </div>
  );
}
