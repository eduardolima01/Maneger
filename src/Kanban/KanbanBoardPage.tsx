import { useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Kanban } from '@/types/kanban.types';
import { getKanbanById } from '@/lib/api/kanban/kanbans';
import KanbanBoard from '@/Projects/Project/modules/kanban/KanbanBoard';
import { useTabMeta } from '@/components/layout/tabs/useTabMeta';

export default function KanbanBoardPage() {
  const { kanbanId } = useParams({ from: '/kanban/$kanbanId' });
  const [kanban, setKanban] = useState<Kanban | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setKanban(null);
    getKanbanById(kanbanId).then((k) => {
      setKanban(k);
      setLoading(false);
    });
  }, [kanbanId]);

  useTabMeta({
    title: loading ? 'Carregando...' : kanban ? kanban.name : 'Kanban não encontrado',
    icon: '📋',
    status: loading ? 'loading' : kanban ? 'ready' : 'not-found',
    breadcrumb: kanban ? [kanban.name] : undefined,
  });

  if (loading) return null;
  if (!kanban) return <p>Kanban não encontrado.</p>;

  return (
    <div>
      <h1 style={{ marginBottom: 12 }}>{kanban.name}</h1>
      <KanbanBoard kanban={kanban} />
    </div>
  );
}
