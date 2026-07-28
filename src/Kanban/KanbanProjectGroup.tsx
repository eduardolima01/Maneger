import type { KanbanWithProject } from '@/types/kanban.types';
import { KanbanTreeGroup } from './utils/kanbanGrouping';

interface KanbanProjectGroupProps {
  group: KanbanTreeGroup;
  renderTile: (k: KanbanWithProject) => React.ReactNode;
  depth?: number;
}

export default function KanbanProjectGroup({ group, renderTile, depth = 0 }: KanbanProjectGroupProps) {
  return (
    <div
      style={{
        border: depth > 0 ? '1px solid #eee' : undefined,
        borderRadius: depth > 0 ? 8 : undefined,
        padding: depth > 0 ? 12 : 0,
        backgroundColor: depth > 0 ? '#fafafa' : undefined,
        minWidth: depth > 0 ? 260 : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: group.project.color ?? '#1a73e8', flexShrink: 0 }} />
        <h3 style={{ fontSize: 13, color: '#444', margin: 0, fontWeight: 600 }}>{group.project.name}</h3>
      </div>

      {group.kanbans.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 10,
            marginBottom: group.children.length > 0 ? 12 : 0,
          }}
        >
          {group.kanbans.map(renderTile)}
        </div>
      )}

      {group.children.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {group.children.map((child) => (
            <KanbanProjectGroup key={child.project.id} group={child} renderTile={renderTile} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

