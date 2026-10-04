import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent, type DragMoveEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Button from '@/components/layout/Button';
import ChecklistStatusButtons from '@/Kanban/components/ChecklistStatusButtons';
import { buildChecklistTree, ChecklistTreeNode } from './utils/checklistTree';
import { writeChecklistClipboard, readChecklistClipboard } from './utils/checklistClipboard';
import { useCardChecklist } from '@/lib/hooks/kanban/useCardChecklist';
import type { KanbanChecklistItem, ChecklistItemStatus } from '@/types/kanban.types';
import ChecklistMoveMenu from './ChecklistMoveMenu';

interface ChecklistSectionProps {
  cardId: string;
}

const INDENT_PX = 24; // recuo por nível — também é a "largura de um degrau" do arrastar (1 degrau pra direita = vira sub-item)

/**
 * Conta o item e os descendentes que ENTRAM na conta de tarefas. Item "simples" (marcado como lista simples ou dentro
 * de uma) fica de fora, junto com tudo que está debaixo dele — não tem estado, então não é "pendente" nem "feito".
 */
function countAllDescendants(node: ChecklistTreeNode): { done: number; total: number } {
  if (node.isSimple) return { done: 0, total: 0 };
  let done = node.status === 'done' ? 1 : 0;
  let total = 1;
  for (const child of node.children) {
    const sub = countAllDescendants(child);
    done += sub.done;
    total += sub.total;
  }
  return { done, total };
}

/** Quantos itens estão em listas simples (a raiz marcada + tudo dentro dela). */
function countSimple(nodes: ChecklistTreeNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.isSimple) n++;
    n += countSimple(node.children);
  }
  return n;
}

/**
 * Serializa a árvore pro mesmo formato que parseChecklistText (kanbanChecklist.ts) entende de volta:
 * `- [ ]`/`- [~]`/`- [x]` pra itens com estado, `- [lista] Título` pra raiz de uma lista simples, e `- Título`
 * (sem marcador) pros itens que estão DENTRO dela — o estado deles não existe, então não vai no texto.
 */
function serializeTreeToText(nodes: ChecklistTreeNode[], insideSimple = false, depth = 0): string {
  let out = '';
  for (const node of nodes) {
    const isRoot = !insideSimple && !!node.simple;
    const mark = node.status === 'done' ? 'x' : node.status === 'in_progress' ? '~' : ' ';
    const prefix = isRoot ? '- [lista] ' : insideSimple ? '- ' : `- [${mark}] `;
    out += `${'  '.repeat(depth)}${prefix}${node.title}\n`;
    if (node.children.length > 0) out += serializeTreeToText(node.children, insideSimple || !!node.simple, depth + 1);
  }
  return out;
}

/* ---------- árvore achatada + arrastar e soltar (mesma ideia do "sortable tree" do dnd-kit) ---------- */

interface FlatItem {
  id: string;
  node: ChecklistTreeNode;
  depth: number;
  /** Pai ORIGINAL do item (antes de qualquer arrasto). */
  parentId: string | null;
}

/** Lista só o que está VISÍVEL (filhos de item recolhido ficam de fora), em ordem de tela. */
function flattenTree(nodes: ChecklistTreeNode[], collapsed: Set<string>, depth = 0, parentId: string | null = null): FlatItem[] {
  const out: FlatItem[] = [];
  for (const node of nodes) {
    out.push({ id: node.id, node, depth, parentId });
    if (!collapsed.has(node.id)) out.push(...flattenTree(node.children, collapsed, depth + 1, node.id));
  }
  return out;
}

/** Durante o arrasto o item leva os sub-itens junto: tira eles da lista (a ordem de tela é pré-ordem, pai antes dos filhos). */
function removeChildrenOf(items: FlatItem[], ids: string[]): FlatItem[] {
  const excluded = new Set(ids);
  return items.filter((item) => {
    if (item.parentId && excluded.has(item.parentId)) {
      if (item.node.children.length > 0) excluded.add(item.id);
      return false;
    }
    return true;
  });
}

interface Projection {
  depth: number;
  parentId: string | null;
}

/**
 * Onde o item cairia se soltasse agora: a posição vertical diz ENTRE QUAIS itens, o deslocamento horizontal diz o NÍVEL
 * (1 degrau pra direita = vira sub-item do item de cima; pra esquerda = sobe de nível). O nível fica limitado ao que
 * faz sentido ali: no máximo 1 a mais que o item de cima, e no mínimo o nível do item de baixo.
 */
function getProjection(items: FlatItem[], activeId: string, overId: string, dragOffset: number): Projection | null {
  const overIndex = items.findIndex((i) => i.id === overId);
  const activeIndex = items.findIndex((i) => i.id === activeId);
  if (overIndex < 0 || activeIndex < 0) return null;

  const activeItem = items[activeIndex];
  const newItems = arrayMove(items, activeIndex, overIndex);
  const previousItem = newItems[overIndex - 1];
  const nextItem = newItems[overIndex + 1];

  const projectedDepth = activeItem.depth + Math.round(dragOffset / INDENT_PX);
  const maxDepth = previousItem ? previousItem.depth + 1 : 0;
  const minDepth = nextItem ? nextItem.depth : 0;
  const depth = Math.min(maxDepth, Math.max(minDepth, projectedDepth));

  let parentId: string | null;
  if (depth === 0 || !previousItem) parentId = null;
  else if (depth === previousItem.depth) parentId = previousItem.parentId;
  else if (depth > previousItem.depth) parentId = previousItem.id;
  else parentId = newItems.slice(0, overIndex).reverse().find((i) => i.depth === depth)?.parentId ?? null;

  return { depth, parentId };
}

/* ---------- campo de sub-item ---------- */

/**
 * Campo de "novo sub-item" que aparece embaixo do item. Enter adiciona e continua aberto (pra criar vários em
 * sequência); Esc cancela; clicar FORA com texto digitado também adiciona (e fecha) — o texto não se perde.
 */
function SubItemInput({ depth, onSubmit, onClose }: { depth: number; onSubmit: (title: string) => void; onClose: () => void }) {
  const [value, setValue] = useState('');
  const cancelledRef = useRef(false);
  const unmountingRef = useRef(false);

  // Se o campo for desmontado com o foco nele (ex.: ele muda de posição na lista depois de criar um sub-item), o
  // navegador pode disparar um blur — esse não é um "clicar fora" e não deve fechar o campo nem adicionar nada.
  // O `= false` no corpo do efeito é essencial: no React StrictMode (modo dev) o efeito monta, desmonta e monta de novo,
  // e sem ele a flag ficaria `true` para sempre depois da "desmontagem de teste" — todo clique fora seria ignorado.
  useLayoutEffect(() => {
    unmountingRef.current = false;
    return () => { unmountingRef.current = true; };
  }, []);

  function submit() {
    const title = value.trim();
    if (!title) return;
    setValue('');
    onSubmit(title);
  }

  return (
    <div style={{ marginLeft: depth * INDENT_PX, marginBottom: 4 }}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          if (e.key === 'Escape') { e.stopPropagation(); cancelledRef.current = true; onClose(); }
        }}
        onBlur={() => {
          if (unmountingRef.current || cancelledRef.current) return;
          submit();
          onClose();
        }}
        placeholder="Sub-item..."
        className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]"
        style={{ width: '100%', boxSizing: 'border-box', padding: 4, fontSize: 12 }}
      />
    </div>
  );
}

/* ---------- linha do item ---------- */

interface ChecklistRowProps {
  item: FlatItem;
  /** Nível mostrado: o do item, ou o PROJETADO enquanto ele está sendo arrastado (mostra onde vai cair). */
  displayDepth: number;
  collapsed: boolean;
  addingSub: boolean;
  onToggleCollapse: (id: string) => void;
  onAddSubClick: (id: string) => void;
  onSetStatus: (id: string, status: ChecklistItemStatus) => void;
  /** Marca/desmarca o item como lista simples (sem estado, fora da contagem). */
  onSetSimple: (id: string, simple: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  /** Muda o pai do item (null = tarefa principal); `afterItemId` = ficar logo depois desse irmão. */
  onMove: (id: string, newParentId: string | null, afterItemId?: string) => void;
  /** Lista plana de todos os itens do card — o menu de mover monta a árvore de destinos com ela. */
  items: KanbanChecklistItem[];
}

function ChecklistRow({
  item, displayDepth, collapsed, addingSub, onToggleCollapse, onAddSubClick, onSetStatus, onSetSimple, onRename, onDelete, onMove, items,
}: ChecklistRowProps) {
  const { node } = item;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [titleDraft, setTitleDraft] = useState(node.title);
  const [moveMenu, setMoveMenu] = useState<{ x: number; y: number } | null>(null);

  const hasChildren = node.children.length > 0;
  const simple = node.isSimple; // marcado como lista simples OU dentro de uma
  const isDone = !simple && node.status === 'done';
  const subCounts = hasChildren && !simple
    ? { done: countAllDescendants(node).done - (node.status === 'done' ? 1 : 0), total: countAllDescendants(node).total - 1 }
    : { done: 0, total: 0 };

  // Só o movimento VERTICAL segue o mouse: o horizontal vira o recuo (displayDepth), que "encaixa" de degrau em degrau.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null),
    transition,
    opacity: isDragging ? 0.6 : 1,
    marginLeft: displayDepth * INDENT_PX,
    marginBottom: 4,
  };

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

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`bg-white dark:bg-neutral-800 border ${isDragging ? 'border-blue-500 dark:border-blue-400' : 'border-neutral-200 dark:border-neutral-700'}`}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 4 }}
      >
        <span
          {...attributes}
          {...listeners}
          className="text-neutral-400 dark:text-neutral-500"
          style={{ fontSize: 11, cursor: 'grab', touchAction: 'none' }}
          title="Arrastar: pra cima/baixo reordena; pra direita vira sub-item do item de cima; pra esquerda sobe de nível"
        >
          ⠿
        </span>
        <button
          onClick={() => onToggleCollapse(node.id)}
          className={hasChildren ? 'text-neutral-500 dark:text-neutral-400' : 'text-transparent'}
          style={{ border: 'none', background: 'none', cursor: hasChildren ? 'pointer' : 'default', fontSize: 10, padding: 0, width: 12 }}
        >
          {hasChildren ? (collapsed ? '▶' : '▼') : '·'}
        </button>
        {!simple && <ChecklistStatusButtons status={node.status} onChange={(status) => onSetStatus(node.id, status)} />}
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => titleDraft.trim() && titleDraft !== node.title && onRename(node.id, titleDraft.trim())}
          className={isDone ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-900 dark:text-neutral-100'}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 13, background: 'transparent',
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        />
        {!simple && subCounts.total > 0 && <span className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 10 }}>{subCounts.done}/{subCounts.total}</span>}
        <button
          onClick={() => onAddSubClick(node.id)}
          title="Adicionar sub-item"
          className={addingSub ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500 dark:text-neutral-400'}
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
        >
          ＋
        </button>
        {/* Itens DENTRO de uma lista simples herdam o modo dela: só quem não está dentro de uma pode alternar. */}
        {!node.inheritedSimple && (
          <button
            onClick={() => onSetSimple(node.id, !node.simple)}
            title={node.simple
              ? 'Lista simples: sem estado e fora da contagem de tarefas. Clique pra voltar a ter estados'
              : 'Virar lista simples (este item e o que está dentro dele ficam sem estado e fora da contagem de tarefas)'}
            aria-pressed={!!node.simple}
            className={node.simple ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500 dark:text-neutral-400'}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}
          >
            ☰
          </button>
        )}
        <button
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMoveMenu({ x: r.left, y: r.bottom + 4 }); }}
          title="Mover: virar sub-item, subir de nível, mudar de item pai"
          className={moveMenu ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500 dark:text-neutral-400'}
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}
        >
          ⇄
        </button>
        <button onClick={() => onDelete(node.id)} className="text-red-600 dark:text-red-400" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
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
    </div>
  );
}

/* ---------- seção ---------- */

export default function ChecklistSection({ cardId }: ChecklistSectionProps) {
  const { items, loading, create, createSubItem, setStatus, setSimple, rename, remove,
    move, place, replaceAllFromText, appendFromText } = useCardChecklist(cardId);
  const [newTitle, setNewTitle] = useState('');
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [mode, setMode] = useState<'view' | 'text'>('view');
  const [textDraft, setTextDraft] = useState('');
  const [applying, setApplying] = useState(false);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(noticeTimerRef.current), []);

  const tree = useMemo(() => buildChecklistTree(items), [items]);
  const flat = useMemo(() => flattenTree(tree, collapsed), [tree, collapsed]);
  const dragFlat = useMemo(() => (activeId ? removeChildrenOf(flat, [activeId]) : flat), [flat, activeId]);
  const projected = activeId && overId ? getProjection(dragFlat, activeId, overId, offsetLeft) : null;

  // Só entram na conta os itens com estado: o que está em lista simples não é pendente nem feito.
  const { done: totalDone, total: totalAll } = tree.reduce(
    (acc, node) => {
      const c = countAllDescendants(node);
      return { done: acc.done + c.done, total: acc.total + c.total };
    },
    { done: 0, total: 0 }
  );
  const simpleCount = countSimple(tree);
  const pct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

  // Campo de sub-item: aparece depois do ÚLTIMO descendente visível do item (a ordem de tela é pré-ordem).
  let subInputAfterIndex = -1;
  let subInputDepth = 0;
  if (addingSubFor && !activeId) {
    const parentIndex = flat.findIndex((f) => f.id === addingSubFor);
    if (parentIndex >= 0) {
      const parentDepth = flat[parentIndex].depth;
      let last = parentIndex;
      while (last + 1 < flat.length && flat[last + 1].depth > parentDepth) last++;
      subInputAfterIndex = last;
      subInputDepth = parentDepth + 1;
    }
  }

  function expand(id: string) {
    setCollapsed((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleAddSubClick(id: string) {
    if (addingSubFor === id) { setAddingSubFor(null); return; }
    expand(id);
    setAddingSubFor(id);
  }

  async function handleCreateSub(parentId: string, title: string) {
    expand(parentId);
    await createSubItem(parentId, title);
  }

  function handleMove(id: string, newParentId: string | null, afterItemId?: string) {
    if (newParentId) expand(newParentId); // o item movido não pode "sumir" dentro de um pai recolhido
    move(id, newParentId, afterItemId);
  }

  /* ----- arrastar e soltar ----- */

  function resetDrag() {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setOverId(String(active.id));
    setAddingSubFor(null);
  }

  function handleDragMove({ delta }: DragMoveEvent) {
    setOffsetLeft(delta.x);
  }

  function handleDragOver({ over }: DragOverEvent) {
    setOverId(over ? String(over.id) : null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const proj = projected;
    resetDrag();
    if (!proj || !over) return;

    const activeIndex = dragFlat.findIndex((i) => i.id === active.id);
    const overIndex = dragFlat.findIndex((i) => i.id === over.id);
    if (activeIndex < 0 || overIndex < 0) return;

    const movedId = dragFlat[activeIndex].id;
    const sorted = arrayMove(dragFlat, activeIndex, overIndex);
    const movedIndex = sorted.findIndex((i) => i.id === movedId);

    // Irmão visível imediatamente antes do item no destino: o primeiro item acima com o MESMO nível projetado, sem
    // atravessar o pai (um item de nível menor). Os mais fundos que passam no caminho são sub-itens de um irmão anterior.
    let prevSiblingId: string | null = null;
    for (let k = movedIndex - 1; k >= 0; k--) {
      const candidate = sorted[k];
      if (candidate.depth < proj.depth) break;
      if (candidate.depth === proj.depth) { prevSiblingId = candidate.id; break; }
    }

    // Ordem final dos filhos do novo pai — usando TODOS os filhos reais (os de itens recolhidos também), não só os visíveis.
    const byPosition = (a: KanbanChecklistItem, b: KanbanChecklistItem) => a.position - b.position;
    const siblingIds = items
      .filter((i) => (i.parentItemId ?? null) === proj.parentId && i.id !== movedId)
      .sort(byPosition)
      .map((i) => i.id);
    const at = prevSiblingId ? siblingIds.indexOf(prevSiblingId) + 1 : 0;
    const ordered = [...siblingIds.slice(0, at), movedId, ...siblingIds.slice(at)];

    // Soltou no mesmo lugar: nada a gravar.
    const current = items.find((i) => i.id === movedId);
    if (current && (current.parentItemId ?? null) === proj.parentId) {
      const currentOrder = items
        .filter((i) => (i.parentItemId ?? null) === proj.parentId)
        .sort(byPosition)
        .map((i) => i.id);
      if (currentOrder.join('|') === ordered.join('|')) return;
    }

    if (proj.parentId) expand(proj.parentId);
    place(movedId, proj.parentId, ordered);
  }

  /* ----- novo item: Enter ou clicar fora do campo adiciona ----- */

  async function handleAdd(keepFocus = true) {
    const title = newTitle.trim();
    if (!title) return;
    // limpa ANTES do await: clicar no botão "+ Adicionar" tira o foco do campo (e o blur já adiciona) — assim o clique
    // do botão encontra o campo vazio e não adiciona o mesmo item duas vezes
    setNewTitle('');
    await create(title);
    if (keepFocus) newItemInputRef.current?.focus();
  }

  /* ----- copiar / colar lista ----- */

  function showNotice(message: string) {
    setNotice(message);
    window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 2500);
  }

  async function handleCopyList() {
    if (items.length === 0) { showNotice('A lista está vazia'); return; }
    await writeChecklistClipboard(serializeTreeToText(tree));
    showNotice(`Lista copiada (${items.length} ${items.length === 1 ? 'item' : 'itens'})`);
  }

  async function handlePasteList() {
    const text = await readChecklistClipboard();
    if (!text) { showNotice('Nada copiado ainda'); return; }
    const count = await appendFromText(text);
    showNotice(count > 0 ? `${count} ${count === 1 ? 'item colado' : 'itens colados'}` : 'Nada pra colar');
  }

  /* ----- modo texto ----- */

  function enterTextMode() {
    let draft = serializeTreeToText(tree);
    const pending = newTitle.trim(); // o que foi digitado em "Novo item..." e ainda não foi adicionado não se perde
    if (pending) {
      draft += `- [ ] ${pending}\n`;
      setNewTitle('');
    }
    setTextDraft(draft);
    setMode('text');
  }

  async function applyTextMode() {
    setApplying(true);
    await replaceAllFromText(textDraft);
    setApplying(false);
    setMode('view');
  }

  if (loading) return <p className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 12 }}>Carregando...</p>;

  // Os botões da barra não tiram o foco do campo "Novo item..." (onMouseDown preventDefault): assim o texto digitado
  // não é adicionado por um "blur" no meio de uma ação como "Modo texto".
  const preventBlur = (e: React.MouseEvent) => e.preventDefault();
  const LINK_CLS = 'text-blue-600 dark:text-blue-400';
  const linkStyle: React.CSSProperties = { border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, padding: 0 };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {mode === 'view' && (
            <>
              <button
                onMouseDown={preventBlur}
                onClick={handleCopyList}
                title="Copiar a lista inteira (dá pra colar em outro card, de qualquer kanban)"
                className={LINK_CLS}
                style={linkStyle}
              >
                ⧉ Copiar lista
              </button>
              <button
                onMouseDown={preventBlur}
                onClick={handlePasteList}
                title="Colar a última lista copiada no fim desta lista"
                className={LINK_CLS}
                style={linkStyle}
              >
                📥 Colar lista
              </button>
            </>
          )}
          {notice && <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11 }}>{notice}</span>}
        </div>
        <button
          onMouseDown={preventBlur}
          onClick={() => (mode === 'view' ? enterTextMode() : setMode('view'))}
          title={mode === 'view' ? 'Editar a checklist como texto' : 'Voltar pra visualização normal (sem aplicar)'}
          className={LINK_CLS}
          style={{ ...linkStyle, flexShrink: 0 }}
        >
          {mode === 'view' ? '📝 Modo texto' : '📋 Modo visual'}
        </button>
      </div>

      {(totalAll > 0 || simpleCount > 0) && (
        <div style={{ marginBottom: 8 }}>
          {totalAll > 0 && (
            <>
              <div className="text-neutral-500 dark:text-neutral-400" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span>{totalDone}/{totalAll} concluído{totalAll !== 1 ? 's' : ''}</span>
                <span style={{ fontWeight: 600 }}>{pct}%</span>
              </div>
              <div className="bg-neutral-200 dark:bg-neutral-700" style={{ height: 4, borderRadius: 2, overflow: 'hidden' }}>
                <div className="bg-blue-600" style={{ height: '100%', width: `${pct}%`, transition: 'width 0.2s' }} />
              </div>
            </>
          )}
          {simpleCount > 0 && (
            <div className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11, marginTop: totalAll > 0 ? 4 : 0 }}>
              ☰ {simpleCount} item{simpleCount !== 1 ? 's' : ''} em listas simples (fora da contagem)
            </div>
          )}
        </div>
      )}

      {mode === 'view' ? (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={resetDrag}
          >
            <SortableContext items={dragFlat.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {dragFlat.map((item, index) => (
                <Fragment key={item.id}>
                  <ChecklistRow
                    item={item}
                    displayDepth={item.id === activeId && projected ? projected.depth : item.depth}
                    collapsed={collapsed.has(item.id)}
                    addingSub={addingSubFor === item.id}
                    onToggleCollapse={toggleCollapse}
                    onAddSubClick={handleAddSubClick}
                    onSetStatus={setStatus}
                    onSetSimple={setSimple}
                    onRename={rename}
                    onDelete={remove}
                    onMove={handleMove}
                    items={items}
                  />
                  {subInputAfterIndex === index && addingSubFor && (
                    <SubItemInput
                      key={`sub-input:${addingSubFor}`}
                      depth={subInputDepth}
                      onSubmit={(title) => handleCreateSub(addingSubFor, title)}
                      onClose={() => setAddingSubFor(null)}
                    />
                  )}
                </Fragment>
              ))}
            </SortableContext>
          </DndContext>

          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input
              ref={newItemInputRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              onBlur={() => handleAdd(false)}
              placeholder="Novo item..."
              className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]"
              style={{ flex: 1, padding: 6, fontSize: 13 }}
            />
            <Button variant="secondary" onClick={() => handleAdd()}>+ Adicionar</Button>
          </div>
        </>
      ) : (
        <div>
          <textarea
            autoFocus
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            placeholder={'- [ ] tarefa\n  - [~] sub-tarefa em andamento\n  - [x] sub-tarefa já feita\n- [lista] anotações (sem estado)\n  - item solto'}
            rows={10}
            className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark] border border-neutral-300"
            style={{
              width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 12,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', resize: 'vertical',
              borderRadius: 4,
            }}
          />
          <p className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11, margin: '4px 0 8px' }}>
            Um item por linha: "- [ ]" não iniciado, "- [~]" em andamento, "- [x]" feito. "- [lista]" abre uma lista
            simples: o que estiver indentado debaixo dela fica sem estado e fora da contagem. 2 espaços de
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
