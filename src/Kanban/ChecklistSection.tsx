import { useRef, useState } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Button from '@/components/layout/Button';
import { buildChecklistTree, ChecklistTreeNode } from './utils/checklistTree';
import { useCardChecklist } from '@/lib/hooks/kanban/useCardChecklist';

interface ChecklistSectionProps {
  cardId: string;
}

function countAllDescendants(node: ChecklistTreeNode): { done: number; total: number } {
  let done = node.checked ? 1 : 0;
  let total = 1;
  for (const child of node.children) {
    const sub = countAllDescendants(child);
    done += sub.done;
    total += sub.total;
  }
  return { done, total };
}

interface ChecklistNodeRowProps {
  node: ChecklistTreeNode;
  onToggle: (id: string, checked: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onCreateSub: (parentId: string, title: string) => void;
  onReorderSiblings: (parentId: string | null, orderedIds: string[]) => void;
  sensors: ReturnType<typeof useSensors>;
}

function ChecklistNodeRow({ node, onToggle, onRename, onDelete, onCreateSub, onReorderSiblings, sensors }: ChecklistNodeRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  const [titleDraft, setTitleDraft] = useState(node.title);
  const [expanded, setExpanded] = useState(node.children.length > 0);
  const [newSubTitle, setNewSubTitle] = useState('');
  const newSubInputRef = useRef<HTMLInputElement>(null);

  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const hasChildren = node.children.length > 0;
  const { done: subDone, total: subTotal } = hasChildren ? { done: countAllDescendants(node).done - (node.checked ? 1 : 0), total: countAllDescendants(node).total - 1 } : { done: 0, total: 0 };

  function handleSubDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = node.children.map((c) => c.id);
    const from = ids.indexOf(active.id as string);
    const to = ids.indexOf(over.id as string);
    if (from === -1 || to === -1) return;
    onReorderSiblings(node.id, arrayMove(ids, from, to));
  }

  function handleAddSub() {
    if (!newSubTitle.trim()) return;
    onCreateSub(node.id, newSubTitle.trim());
    setNewSubTitle('');
    setExpanded(true);
    newSubInputRef.current?.focus();
  }

  return (
    <div ref={setNodeRef} style={{ ...style, marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', border: '1px solid #eee', borderRadius: 4, backgroundColor: '#fff' }}>
        <span {...attributes} {...listeners} style={{ color: '#bbb', fontSize: 11, cursor: 'grab', touchAction: 'none' }} title="Arrastar">⠿</span>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, color: hasChildren ? '#666' : 'transparent', padding: 0, width: 12 }}
        >
          {hasChildren ? (expanded ? '▼' : '▶') : '·'}
        </button>
        <input type="checkbox" checked={node.checked} onChange={(e) => onToggle(node.id, e.target.checked)} />
        <input
          ref={newSubInputRef}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => titleDraft.trim() && titleDraft !== node.title && onRename(node.id, titleDraft.trim())}
          style={{
            flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent',
            textDecoration: node.checked ? 'line-through' : 'none', color: node.checked ? '#999' : '#000',
          }}
        />
        {hasChildren && <span style={{ fontSize: 10, color: '#999' }}>{subDone}/{subTotal}</span>}
        <button onClick={() => onDelete(node.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 12 }}>✕</button>
      </div>

      {expanded && (
        <div style={{ marginLeft: 24, marginTop: 4 }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubDragEnd}>
            <SortableContext items={node.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {node.children.map((child) => (
                <ChecklistNodeRow
                  key={child.id}
                  node={child}
                  onToggle={onToggle}
                  onRename={onRename}
                  onDelete={onDelete}
                  onCreateSub={onCreateSub}
                  onReorderSiblings={onReorderSiblings}
                  sensors={sensors}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
            <input
              value={newSubTitle}
              onChange={(e) => setNewSubTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSub()}
              placeholder="Sub-item..."
              style={{ flex: 1, padding: 4, fontSize: 12 }}
            />
            <button
              onClick={handleAddSub}
              disabled={!newSubTitle.trim()}
              style={{ padding: '4px 8px', fontSize: 11, border: 'none', borderRadius: 4, backgroundColor: newSubTitle.trim() ? '#666' : '#ccc', color: '#fff', cursor: newSubTitle.trim() ? 'pointer' : 'default' }}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChecklistSection({ cardId }: ChecklistSectionProps) {
  const { items, loading, create, createSubItem, toggle, rename, remove, reorder } = useCardChecklist(cardId);
  const [newTitle, setNewTitle] = useState('');
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const tree = buildChecklistTree(items);
  const totalDone = items.filter((i) => i.checked).length;
  const totalAll = items.length;
  const pct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

  function handleTopDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = tree.map((n) => n.id);
    const from = ids.indexOf(active.id as string);
    const to = ids.indexOf(over.id as string);
    if (from === -1 || to === -1) return;
    reorder(arrayMove(ids, from, to)); // reorder já opera sobre ids globais — cuidado, ver nota abaixo
  }

  function handleReorderSiblings(parentId: string | null, orderedIds: string[]) {
    if (parentId === null) {
      reorder(orderedIds);
    } else {
      reorder(orderedIds); // mesma função — reorderItems no backend só reordena os ids passados, sem depender do parent
    }
  }

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await create(newTitle);
    setNewTitle('');
    newItemInputRef.current?.focus();
  }

  if (loading) return <p style={{ fontSize: 12, color: '#999' }}>Carregando...</p>;

  return (
    <div>
      {totalAll > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666', marginBottom: 4 }}>
            <span>{totalDone}/{totalAll} concluído{totalAll !== 1 ? 's' : ''}</span>
            <span style={{ fontWeight: 600 }}>{pct}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, backgroundColor: '#eee', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#1a73e8', transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTopDragEnd}>
        <SortableContext items={tree.map((n) => n.id)} strategy={verticalListSortingStrategy}>
          {tree.map((node) => (
            <ChecklistNodeRow
              key={node.id}
              node={node}
              onToggle={toggle}
              onRename={rename}
              onDelete={remove}
              onCreateSub={createSubItem}
              onReorderSiblings={handleReorderSiblings}
              sensors={sensors}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input
          ref={newItemInputRef}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Novo item..."
          style={{ flex: 1, padding: 6, fontSize: 13 }}
        />
        <Button variant="secondary" onClick={handleAdd}>+ Adicionar</Button>
      </div>
    </div>
  );
}
