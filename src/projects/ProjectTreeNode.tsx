import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import CardProject from './components/CardProject';
import type { ProjectTreeNode as TreeNode } from '@/lib/utils/projectTree';

interface ProjectTreeNodeProps {
  node: TreeNode;
  depth: number;
  expandedIds: Set<string>;
  onToggleExpanded: (id: string) => void;
  onNewSubproject: (parentId: string) => void;
  onRename: (id: string, currentName: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string) => void;
  onRequestDelete: (id: string, name: string, descendantCount: number) => void;
}

export default function ProjectTreeNode({
  node, depth, expandedIds, onToggleExpanded,
  onNewSubproject, onRename, onDuplicate, onMove, onRequestDelete,
}: ProjectTreeNodeProps) {
  console.log(node)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    data: { parentId: node.parentProjectId },
  });
  const [menuOpen, setMenuOpen] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: depth * 24, marginBottom: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <span {...attributes} {...listeners} style={{ color: '#bbb', fontSize: 12, cursor: 'grab', touchAction: 'none' }} title="Arrastar">
            ⠿
          </span>
          <button
            onClick={() => hasChildren && onToggleExpanded(node.id)}
            style={{ border: 'none', background: 'none', cursor: hasChildren ? 'pointer' : 'default', fontSize: 11, color: hasChildren ? '#333' : 'transparent', padding: 0 }}
          >
            {hasChildren ? (isExpanded ? '▼' : '▶') : '·'}
          </button>
        </div>

        <div style={{ flex: 1 }}>
          <CardProject project={node} />
          {hasChildren && (
            <span style={{ fontSize: 11, color: '#999', marginLeft: 4 }}>
              {node.children.length} subprojeto{node.children.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setMenuOpen((v) => !v)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, padding: '2px 8px' }}>⋮</button>

          {menuOpen && (
            <div
              onMouseLeave={() => setMenuOpen(false)}
              style={{ position: 'absolute', right: 0, top: '100%', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', zIndex: 10, minWidth: 160 }}
            >
              {[
                ['+ Novo subprojeto', () => onNewSubproject(node.id)],
                ['Renomear', () => onRename(node.id, node.name)],
                ['Duplicar', () => onDuplicate(node.id)],
                ['Mover para...', () => onMove(node.id)],
                ['Excluir', () => onRequestDelete(node.id, node.name, countAll(node))],
              ].map(([label, action]) => (
                <button
                  key={label as string}
                  onClick={() => { (action as () => void)(); setMenuOpen(false); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', color: label === 'Excluir' ? '#c62828' : '#000' }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <SortableContext items={node.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {node.children.map((child) => (
            <ProjectTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggleExpanded={onToggleExpanded}
              onNewSubproject={onNewSubproject}
              onRename={onRename}
              onDuplicate={onDuplicate}
              onMove={onMove}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

function countAll(node: TreeNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countAll(c), 0);
}

