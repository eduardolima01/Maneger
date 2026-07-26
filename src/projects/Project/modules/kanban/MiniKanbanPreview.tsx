import type { ColumnCardCount } from '@/lib/api/kanban/kanbanCards';

interface MiniKanbanPreviewProps {
  columns: ColumnCardCount[];
  accentColor: string;
  barMaxHeight?: number;
}

export default function MiniKanbanPreview({ columns, accentColor, barMaxHeight = 36 }: MiniKanbanPreviewProps) {
  const maxCount = Math.max(1, ...columns.map((c) => c.count));

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: barMaxHeight, marginBottom: 4 }}>
        {columns.map((c) => {
          const barHeight = c.count === 0 ? 3 : Math.max(4, (c.count / maxCount) * barMaxHeight);
          return (
            <div
              key={c.columnId}
              title={`${c.columnName}: ${c.count} card${c.count !== 1 ? 's' : ''}`}
              style={{
                flex: 1,
                height: barHeight,
                backgroundColor: c.count === 0 ? '#e8e8e8' : accentColor,
                opacity: c.count === 0 ? 1 : 0.35 + 0.65 * (c.count / maxCount),
                borderRadius: '2px 2px 0 0',
                minWidth: 6,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {columns.map((c) => (
          <div
            key={c.columnId}
            style={{ flex: 1, minWidth: 6, textAlign: 'center', fontSize: 9, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {c.count}
          </div>
        ))}
      </div>
    </div>
  );
}
