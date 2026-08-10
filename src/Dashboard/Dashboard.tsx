import { useState } from 'react';
import DashboardKanbanSection from './components/DashboardKanbanSection';
import DashboardProjectsSection from './components/DashboardProjectsSection';
import RecentProjectsSection from './components/RecentProjectsSection';
import RecentActivitySection from './components/RecentActivitySection';
import FrequentActionsSection from './components/FrequentActionsSection';
import { useProjects } from '@/lib/hooks/useProjects';
import ProjectTimeChart from './components/ProjectTimeChart';

export const Dashboard = () => {
  // instância única, compartilhada entre a seção "Projetos" e "Ações Frequentes"
  // (assim criar um projeto ali já reflete aqui, sem duplicar fetch/lógica)
  const { projects, loading, add } = useProjects();
  const [kanbanRefreshKey, setKanbanRefreshKey] = useState(0);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 13, color: '#999', margin: '4px 0 0' }}>Visão geral da aplicação</p>
      </div>

      <div style={{ marginBottom: 28 }}>
        <ProjectTimeChart projects={projects} />
      </div>

      <div style={{ marginBottom: 28 }}>
        <RecentProjectsSection />
      </div>

      <div style={{ display: 'flex', gap: 24, marginBottom: 28, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 280 }}>
          <DashboardProjectsSection projects={projects} loading={loading} />
        </div>
        <div style={{ flex: '1 1 280px', minWidth: 260 }}>
          <DashboardKanbanSection refreshKey={kanbanRefreshKey} />
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <FrequentActionsSection
          onCreateProject={add}
          onKanbanCreated={() => setKanbanRefreshKey((k) => k + 1)}
        />
      </div>

      <div>
        <RecentActivitySection />
      </div>
    </div>
  );
};
