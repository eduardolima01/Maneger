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
      className={depth > 0 ? 'border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900' : undefined}
      style={{
        borderRadius: depth > 0 ? 8 : undefined,
        padding: depth > 0 ? 12 : 0,
        minWidth: depth > 0 ? 260 : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: group.project.color ?? '#1a73e8', flexShrink: 0 }} />
        <h3 className="text-neutral-700 dark:text-neutral-300" style={{ fontSize: 13, margin: 0, fontWeight: 600 }}>{group.project.name}</h3>
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
