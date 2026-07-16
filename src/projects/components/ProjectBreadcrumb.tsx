import { useProjectBreadcrumb } from '@/lib/hooks/project/useProjectBreadcrumb';
import { Link } from '@tanstack/react-router';

interface ProjectBreadcrumbProps {
  projectId: string;
  refreshToken?: number;
}

export default function ProjectBreadcrumb({ projectId, refreshToken }: ProjectBreadcrumbProps) {
  const { path, loading } = useProjectBreadcrumb(projectId, refreshToken);

  if (loading || path.length === 0) return null;

  return (
    <nav style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, fontSize: 13, color: '#666', marginBottom: 12 }}>
      <Link
        to="/projects"
        style={{ color: '#666' }}
        className="hover:underline"
      >
        🏠 Projetos
      </Link>

      {path.map((p, i) => {
        const isLast = i === path.length - 1;
        return (
          <span key={p.id}
            style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <span style={{ color: '#ccc' }}>/</span>
            {isLast ? (
              <span
                title={p.name}
                style={{
                  fontWeight: 600,
                  color: '#000',
                  maxWidth: 220,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.name}
              </span>
            ) : (
              <Link
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                title={p.name}
                style={{
                  color: '#666', textDecoration: 'none', display: 'inline-block',
                  maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {p.name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
