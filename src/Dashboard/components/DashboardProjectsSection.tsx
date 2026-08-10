import type { ProjectType } from '@/types/project.types';
import CardProject from '@/Projects/components/CardProject';
import { openEntityTab } from '@/components/layout/tabs/tabStore';

interface DashboardProjectsSectionProps {
  projects: ProjectType[];
  loading: boolean;
}

export default function DashboardProjectsSection({ projects, loading }: DashboardProjectsSectionProps) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Projetos</h2>

      {loading && <p style={{ fontSize: 13, color: '#999' }}>Carregando...</p>}

      {!loading && projects.length === 0 && (
        <p style={{ fontSize: 13, color: '#999' }}>Nenhum projeto encontrado.</p>
      )}

      {!loading && projects.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {projects.map((p) => (
            <CardProject
              key={p.id}
              project={p}
              onClick={() => openEntityTab(`/projects/${p.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
