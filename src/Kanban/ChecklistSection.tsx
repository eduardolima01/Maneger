import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Button from '@/components/layout/Button';
import { buildChecklistTree, ChecklistTreeNode } from './utils/checklistTree';
import { useCardChecklist } from '@/lib/hooks/kanban/useCardChecklist';
import { CHECKLIST_STATUS_LABELS, CHECKLIST_STATUS_COLORS } from '@/types/kanban.types';
import type { KanbanChecklistItem, ChecklistItemStatus } from '@/types/kanban.types';
import ChecklistMoveMenu from './ChecklistMoveMenu';

interface ChecklistSectionProps {
  cardId: string;
}

const STATUS_ORDER: ChecklistItemStatus[] = ['not_started', 'in_progress', 'done'];

function countAllDescendants(node: ChecklistTreeNode): { done: number; total: number } {
  let done = node.status === 'done' ? 1 : 0;
  let total = 1;
  for (const child of node.children) {
    const sub = countAllDescendants(child);
    done += sub.done;
    total += sub.total;
  }
  return { done, total };
}

/** Serializa a árvore pro mesmo formato que parseChecklistText (kanbanChecklist.ts) entende de volta. */
function serializeTreeToText(nodes: ChecklistTreeNode[], depth = 0): string {
  let out = '';
  for (const node of nodes) {
    const mark = node.status === 'done' ? 'x' : node.status === 'in_progress' ? '~' : ' ';
    out += `${'  '.repeat(depth)}- [${mark}] ${node.title}\n`;
    if (node.children.length > 0) out += serializeTreeToText(node.children, depth + 1);
  }
  return out;
}

/** Dropdown de status — cor de fundo muda conforme o estado, pra dar pra bater o olho na linha sem ler o texto. */
function StatusSelect({ status, onChange }: { status: ChecklistItemStatus; onChange: (status: ChecklistItemStatus) => void }) {
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as ChecklistItemStatus)}
      style={{
        fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer',
        color: '#fff', backgroundColor: CHECKLIST_STATUS_COLORS[status], fontWeight: 600,
      }}
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s} style={{ backgroundColor: '#fff', color: '#000' }}>{CHECKLIST_STATUS_LABELS[s]}</option>
      ))}
    </select>
  );
}

interface ChecklistNodeRowProps {
  node: ChecklistTreeNode;
  onSetStatus: (id: string, status: ChecklistItemStatus) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onCreateSub: (parentId: string, title: string) => void;
  onReorderSiblings: (parentId: string | null, orderedIds: string[]) => void;
  /** Muda o pai do item (null = tarefa principal); `afterItemId` = ficar logo depois desse irmão. */
  onMove: (id: string, newParentId: string | null, afterItemId?: string) => void;
  /** Lista plana de todos os itens do card — o menu de mover monta a árvore de destinos com ela. */
  items: KanbanChecklistItem[];
  sensors: ReturnType<typeof useSensors>;
}

function ChecklistNodeRow({ node, onSetStatus, onRename, onDelete, onCreateSub, onReorderSiblings, onMove, items, sensors }: ChecklistNodeRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  const [titleDraft, setTitleDraft] = useState(node.title);
  const [expanded, setExpanded] = useState(node.children.length > 0);
  const [newSubTitle, setNewSubTitle] = useState('');
  const subInputRef = useRef<HTMLInputElement>(null);
  const [moveMenu, setMoveMenu] = useState<{ x: number; y: number } | null>(null);
  const previousChildCount = useRef(node.children.length);

  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const hasChildren = node.children.length > 0;
  const isDone = node.status === 'done';

  // Um item que ganha filho (criado aqui OU movido de outro lugar) abre sozinho — senão o item movido pareceria
  // ter sumido, já que `expanded` só era decidido na montagem.
  useEffect(() => {
    if (node.children.length > previousChildCount.current) setExpanded(true);
    previousChildCount.current = node.children.length;
  }, [node.children.length]);
  const { done: subDone, total: subTotal } = hasChildren ? { done: countAllDescendants(node).done - (isDone ? 1 : 0), total: countAllDescendants(node).total - 1 } : { done: 0, total: 0 };

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
    subInputRef.current?.focus();
  }

  /**
   * Botão ＋ da linha. Antes o campo de sub-item só existia com o item EXPANDIDO, e o único jeito de expandir
   * um item sem filhos era o botão "·", que é transparente — na prática não dava pra adicionar o primeiro sub-item.
   * Item sem filhos e campo aberto: o ＋ fecha o campo. Nos outros casos abre (se preciso) e foca o campo.
   */
  function handleOutdent() {
    if (!node.parentItemId) return;
    const grandParentId = items.find((i) => i.id === node.parentItemId)?.parentItemId ?? null;
    setMoveMenu(null);
    onMove(node.id, grandParentId, node.parentItemId); // fica logo depois do antigo pai
  }

  function handlePickParent(parentId: string | null) {
    setMoveMenu(null);
    onMove(node.id, parentId);
  }

  function handleAddSubClick() {
    if (expanded && !hasChildren) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    requestAnimationFrame(() => subInputRef.current?.focus()); // o campo só monta depois do render que expande
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
        <StatusSelect status={node.status} onChange={(status) => onSetStatus(node.id, status)} />
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => titleDraft.trim() && titleDraft !== node.title && onRename(node.id, titleDraft.trim())}
          style={{
            flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent',
            textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#999' : '#000',
          }}
        />
        {hasChildren && <span style={{ fontSize: 10, color: '#999' }}>{subDone}/{subTotal}</span>}
        <button
          onClick={handleAddSubClick}
          title="Adicionar sub-item"
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: expanded ? '#1a73e8' : '#666', fontSize: 14, padding: '0 2px' }}
        >
          ＋
        </button>
        <button
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMoveMenu({ x: r.left, y: r.bottom + 4 }); }}
          title="Mover: virar sub-item, subir de nível, mudar de item pai"
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: moveMenu ? '#1a73e8' : '#666', fontSize: 13, padding: '0 2px' }}
        >
          ⇄
        </button>
        <button onClick={() => onDelete(node.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 12 }}>✕</button>
      </div>

      {moveMenu && createPortal(
        <ChecklistMoveMenu
          x={moveMenu.x}
          y={moveMenu.y}
          items={items}
          movingId={node.id}
          onPickParent={handlePickParent}
          onOutdent={handleOutdent}
          onClose={() => setMoveMenu(null)}
        />,
        document.body
      )}

      {expanded && (
        <div style={{ marginLeft: 24, marginTop: 4 }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubDragEnd}>
            <SortableContext items={node.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {node.children.map((child) => (
                <ChecklistNodeRow
                  key={child.id}
                  node={child}
                  onSetStatus={onSetStatus}
                  onRename={onRename}
                  onDelete={onDelete}
                  onCreateSub={onCreateSub}
                  onReorderSiblings={onReorderSiblings}
                  onMove={onMove}
                  items={items}
                  sensors={sensors}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
            <input
              ref={subInputRef}
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
  const { items, loading, create, createSubItem, setStatus, rename, remove, reorder,
    move, replaceAllFromText } = useCardChecklist(cardId);
  const [newTitle, setNewTitle] = useState('');
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [mode, setMode] = useState<'view' | 'text'>('view');
  const [textDraft, setTextDraft] = useState('');
  const [applying, setApplying] = useState(false);

  const tree = buildChecklistTree(items);
  const totalDone = items.filter((i) => i.status === 'done').length;
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

  function enterTextMode() {
    setTextDraft(serializeTreeToText(tree));
    setMode('text');
  }

  async function applyTextMode() {
    setApplying(true);
    await replaceAllFromText(textDraft);
    setApplying(false);
    setMode('view');
  }

  if (loading) return <p style={{ fontSize: 12, color: '#999' }}>Carregando...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button
          onClick={() => (mode === 'view' ? enterTextMode() : setMode('view'))}
          title={mode === 'view' ? 'Editar a checklist como texto' : 'Voltar pra visualização normal (sem aplicar)'}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1a73e8', fontSize: 11 }}
        >
          {mode === 'view' ? '📝 Modo texto' : '📋 Modo visual'}
        </button>
      </div>

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

      {mode === 'view' ? (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTopDragEnd}>
            <SortableContext items={tree.map((n) => n.id)} strategy={verticalListSortingStrategy}>
              {tree.map((node) => (
                <ChecklistNodeRow
                  key={node.id}
                  node={node}
                  onSetStatus={setStatus}
                  onRename={rename}
                  onDelete={remove}
                  onCreateSub={createSubItem}
                  onReorderSiblings={handleReorderSiblings}
                  onMove={move}
                  items={items}
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
        </>
      ) : (
        <div>
          <textarea
            autoFocus
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            placeholder={'- [ ] tarefa\n  - [~] sub-tarefa em andamento\n  - [x] sub-tarefa já feita'}
            rows={10}
            style={{
              width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 12,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', resize: 'vertical',
              backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: 4,
            }}
          />
          <p style={{ fontSize: 11, color: '#999', margin: '4px 0 8px' }}>
            Um item por linha: "- [ ]" não iniciado, "- [~]" em andamento, "- [x]" feito. 2 espaços de
            indentação = sub-item. Aplicar substitui a checklist inteira do card por isto.
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="secondary" onClick={applyTextMode} disabled={applying}>
              {applying ? 'Aplicando...' : 'Aplicar'}
            </Button>
            <Button variant="secondary" onClick={() => setMode('view')} disabled={applying}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
