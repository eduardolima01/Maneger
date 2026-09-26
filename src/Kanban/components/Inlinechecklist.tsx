import { Fragment, useEffect, useState } from 'react';
import { useCardChecklist } from '@/lib/hooks/kanban/useCardChecklist';
import { buildChecklistTree, ChecklistTreeNode } from '../utils/checklistTree';
import { CHECKLIST_STATUS_LABELS, CHECKLIST_STATUS_COLORS } from '@/types/kanban.types';
import type { ChecklistItemStatus } from '@/types/kanban.types';

interface InlineChecklistProps {
  cardId: string;
  /** Chamado sempre que a contagem muda (adicionar/marcar/remover), pro card por fora mostrar em tempo real. */
  onProgressChange?: (progress: { done: number; total: number }) => void;
}

const INDENT_PX = 14;
const CHECKBOX_OFFSET_PX = 19; // largura do dropdown de status + gap, pra alinhar o campo de sub-item com o texto do item
const STATUS_ORDER: ChecklistItemStatus[] = ['not_started', 'in_progress', 'done'];

function flattenWithDepth(nodes: ChecklistTreeNode[], depth = 0): { node: ChecklistTreeNode; depth: number }[] {
  const result: { node: ChecklistTreeNode; depth: number }[] = [];
  for (const node of nodes) {
    result.push({ node, depth });
    result.push(...flattenWithDepth(node.children, depth + 1));
  }
  return result;
}

/**
 * Versão compacta do checklist pra editar direto no card, sem abrir o modal.
 * Adicionar/marcar/remover e adicionar sub-item (botão ＋ em cada item, em qualquer profundidade) —
 * sem arrastar e sem renomear (isso continua no `ChecklistSection.tsx`, dentro do modal de detalhes).
 */
export default function InlineChecklist({ cardId, onProgressChange }: InlineChecklistProps) {
  const { items, loading, create, createSubItem, setStatus, remove } = useCardChecklist(cardId);
  const [newTitle, setNewTitle] = useState('');
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [subTitle, setSubTitle] = useState('');

  const flat = flattenWithDepth(buildChecklistTree(items));

  // O campo de sub-item aparece depois do ÚLTIMO descendente do item (os descendentes vêm em sequência na lista
  // achatada, com profundidade maior) — assim o novo sub-item, que entra no fim dos filhos, nasce onde o campo está.
  const subInput = (() => {
    if (!addingSubFor) return null;
    const parentIndex = flat.findIndex((f) => f.node.id === addingSubFor);
    if (parentIndex < 0) return null;
    const parentDepth = flat[parentIndex].depth;
    let lastIndex = parentIndex;
    while (lastIndex + 1 < flat.length && flat[lastIndex + 1].depth > parentDepth) lastIndex++;
    return { afterIndex: lastIndex, depth: parentDepth + 1, parentId: addingSubFor };
  })();

  useEffect(() => {
    if (loading) return;
    onProgressChange?.({ done: items.filter((i) => i.status === 'done').length, total: items.length });
  }, [items, loading, onProgressChange]);

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await create(newTitle.trim());
    setNewTitle('');
  }

  async function handleAddSub(parentId: string) {
    const title = subTitle.trim();
    if (!title) return;
    setSubTitle(''); // limpa antes do await: o próximo Enter já encontra o campo vazio (permite criar vários em sequência)
    await createSubItem(parentId, title);
  }

  function closeSubInput() {
    setAddingSubFor(null);
    setSubTitle('');
  }

  if (loading) return <p style={{ fontSize: 11, color: '#bbb', margin: '4px 0' }}>Carregando...</p>;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ marginTop: 2, marginBottom: 4 }}
    >
      {flat.map(({ node, depth }, index) => {
        const isDone = node.status === 'done';
        return (
          <Fragment key={node.id}>
            {/* longhand DEPOIS do shorthand: antes `paddingLeft` vinha antes de `padding` e era anulado — o recuo dos filhos não aparecia */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0', paddingLeft: depth * INDENT_PX }}>
              <select
                value={node.status}
                onChange={(e) => { e.stopPropagation(); setStatus(node.id, e.target.value as ChecklistItemStatus); }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flexShrink: 0, fontSize: 9, padding: '1px 2px', borderRadius: 3, border: '1px solid #ddd', cursor: 'pointer',
                  color: '#fff', backgroundColor: CHECKLIST_STATUS_COLORS[node.status], fontWeight: 600,
                }}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s} style={{ backgroundColor: '#fff', color: '#000' }}>{CHECKLIST_STATUS_LABELS[s]}</option>
                ))}
              </select>
              <span
                style={{
                  flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#999' : '#333',
                }}
              >
                {node.title}
              </span>
              <button
                onClick={() => (addingSubFor === node.id ? closeSubInput() : (setAddingSubFor(node.id), setSubTitle('')))}
                title="Adicionar sub-item"
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: addingSubFor === node.id ? '#1a73e8' : '#999', fontSize: 12, flexShrink: 0, padding: '0 2px' }}
              >
                ＋
              </button>
              <button
                onClick={() => remove(node.id)}
                title="Remover"
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 10, flexShrink: 0, padding: '0 2px' }}
              >
                ✕
              </button>
            </div>

            {subInput && subInput.afterIndex === index && (
              <div style={{ padding: '2px 0', paddingLeft: subInput.depth * INDENT_PX + CHECKBOX_OFFSET_PX }}>
                <input
                  autoFocus
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAddSub(subInput.parentId); }
                    if (e.key === 'Escape') { e.stopPropagation(); closeSubInput(); }
                  }}
                  onBlur={() => {
                    if (subTitle.trim()) handleAddSub(subInput.parentId); // sair do campo com texto salva, como no "criar grupo"
                    closeSubInput();
                  }}
                  placeholder="+ sub-item..."
                  style={{ width: '100%', boxSizing: 'border-box', padding: 3, fontSize: 11, border: '1px solid #cfe0fc', borderRadius: 3 }}
                />
              </div>
            )}
          </Fragment>
        );
      })}

      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="+ item..."
          style={{ flex: 1, padding: 3, fontSize: 11, border: '1px solid #eee', borderRadius: 3 }}
        />
      </div>
    </div>
  );
}
