import { openEntityTab } from '@/components/layout/tabs/tabStore';
import { useRecentProjects } from '../recentActivity';

export default function RecentProjectsSection() {
  const recent = useRecentProjects(8);

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Projetos Recentes</h2>

      {recent.length === 0 && (
        <p style={{ fontSize: 13, color: '#999' }}>Nenhum projeto acessado recentemente.</p>
      )}

      {recent.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {recent.map((p: any) => (
            <div
              key={p.id}
              onClick={() => openEntityTab(`/projects/${p.id}`)}
              style={{
                border: '1px solid #e5e7eb', borderRadius: 20, padding: '6px 14px',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', backgroundColor: '#fff',
              }}
              className="hover:shadow-sm"
            >
              📁 {p.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
