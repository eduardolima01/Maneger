import { getBreadcrumbSegments } from '../utils/pathUtils';

interface ExplorerBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

export default function ExplorerBreadcrumb({ path, onNavigate }: ExplorerBreadcrumbProps) {
  const segments = getBreadcrumbSegments(path);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 16px', fontSize: 13, flexWrap: 'wrap' }}>
      {segments.map((segment, i) => (
        <span key={segment.path} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => onNavigate(segment.path)}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 4,
              fontSize: 13,
              fontWeight: i === segments.length - 1 ? 600 : 400,
              color: i === segments.length - 1 ? '#000' : '#1a73e8',
            }}
          >
            {segment.label}
          </button>
          {i < segments.length - 1 && <span style={{ color: '#999' }}>/</span>}
        </span>
      ))}
    </div>
  );
}
