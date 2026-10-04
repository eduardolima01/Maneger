import { Fragment, useEffect, useState } from 'react';
import { useCardChecklist } from '@/lib/hooks/kanban/useCardChecklist';
import { buildChecklistTree, ChecklistTreeNode } from '../utils/checklistTree';
import ChecklistStatusButtons from './ChecklistStatusButtons';
import type { ChecklistProgress } from '@/types/kanban.types';

interface InlineChecklistProps {
  cardId: string;
  /** Chamado sempre que a contagem muda (adicionar/marcar/remover), pro card por fora mostrar em tempo real. */
  onProgressChange?: (progress: ChecklistProgress) => void;
}

const INDENT_PX = 14;
const STATUS_OFFSET_PX = 57; // largura dos 3 botões de estado (3×16 + 2×2 de gap) + gap, pra alinhar o campo de sub-item com o texto do item
const PLAIN_OFFSET_PX = 13; // item de lista simples: só o marcador "•" (8) + gap

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
    return { afterIndex: lastIndex, depth: parentDepth + 1, parentId: addingSubFor, simple: flat[parentIndex].node.isSimple };
  })();

  useEffect(() => {
    if (loading) return;
    // itens de lista simples não entram na conta (nem como pendentes nem como feitos) — só em `simpleCount`
    let done = 0;
    let total = 0;
    let simpleCount = 0;
    for (const { node } of flattenWithDepth(buildChecklistTree(items))) {
      if (node.isSimple) simpleCount++;
      else { total++; if (node.status === 'done') done++; }
    }
    onProgressChange?.({ done, total, simpleCount });
  }, [items, loading, onProgressChange]);

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle(''); // limpa antes do await: o blur e o Enter não adicionam o mesmo item duas vezes
    await create(title);
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

  if (loading) return <p className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11, margin: '4px 0' }}>Carregando...</p>;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ marginTop: 2, marginBottom: 4 }}
    >
      {flat.map(({ node, depth }, index) => {
        const isDone = !node.isSimple && node.status === 'done';
        return (
          <Fragment key={node.id}>
            {/* longhand DEPOIS do shorthand: antes `paddingLeft` vinha antes de `padding` e era anulado — o recuo dos filhos não aparecia */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0', paddingLeft: depth * INDENT_PX }}>
              {node.isSimple ? (
                <span className="text-neutral-400 dark:text-neutral-500" style={{ flexShrink: 0, fontSize: 11, width: 8, textAlign: 'center' }}>•</span>
              ) : (
                <ChecklistStatusButtons status={node.status} onChange={(s) => setStatus(node.id, s)} size={16} />
              )}
              <span
                className={isDone ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-800 dark:text-neutral-200'}
                style={{
                  flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textDecoration: isDone ? 'line-through' : 'none',
                }}
              >
                {node.title}
              </span>
              <button
                onClick={() => (addingSubFor === node.id ? closeSubInput() : (setAddingSubFor(node.id), setSubTitle('')))}
                title="Adicionar sub-item"
                className={addingSubFor === node.id ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 dark:text-neutral-500'}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, flexShrink: 0, padding: '0 2px' }}
              >
                ＋
              </button>
              <button
                onClick={() => remove(node.id)}
                title="Remover"
                className="text-red-600 dark:text-red-400"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, flexShrink: 0, padding: '0 2px' }}
              >
                ✕
              </button>
            </div>

            {subInput && subInput.afterIndex === index && (
              <div style={{ padding: '2px 0', paddingLeft: subInput.depth * INDENT_PX + (subInput.simple ? PLAIN_OFFSET_PX : STATUS_OFFSET_PX) }}>
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
                  className="border-blue-200 dark:border-blue-900 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                  style={{ width: '100%', boxSizing: 'border-box', padding: 3, fontSize: 11, borderWidth: 1, borderStyle: 'solid', borderRadius: 3 }}
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
          onBlur={() => handleAdd()} // clicar fora do campo com texto digitado também adiciona
          placeholder="+ item..."
          className="border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
          style={{ flex: 1, padding: 3, fontSize: 11, borderWidth: 1, borderStyle: 'solid', borderRadius: 3 }}
        />
      </div>
    </div>
  );
}
