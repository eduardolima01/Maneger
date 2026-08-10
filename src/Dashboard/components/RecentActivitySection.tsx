import { useRecentActivity } from "../recentActivity";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} minuto${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} hora${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? '' : 's'}`;
}

const ICONS: Record<string, string> = {
  project_opened: '📁',
  kanban_opened: '📋',
};

const VERBS: Record<string, string> = {
  project_opened: 'Projeto aberto',
  kanban_opened: 'Kanban acessado',
};

export default function RecentActivitySection() {
  const { entries } = useRecentActivity();
  const recent = entries.slice(0, 10);

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Atividade Recente</h2>

      {recent.length === 0 && (
        <p style={{ fontSize: 13, color: '#999' }}>Nenhuma atividade recente.</p>
      )}

      {recent.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recent.map((e, i) => (
            <div key={`${e.id}-${e.timestamp}-${i}`} style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{ICONS[e.type] ?? '•'} {e.label}</div>
              <div style={{ color: '#999', fontSize: 12 }}>
                {VERBS[e.type] ?? e.type}
                {e.type === 'kanban_opened' && e.projectName ? ` · ${e.projectName}` : ''}
                {' — '}{timeAgo(e.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
