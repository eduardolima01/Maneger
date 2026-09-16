import { useEffect, useState } from 'react';
import { useCardChecklist } from '@/lib/hooks/kanban/useCardChecklist';
import { buildChecklistTree, ChecklistTreeNode } from '../utils/checklistTree';

interface InlineChecklistProps {
  cardId: string;
  /** Chamado sempre que a contagem muda (adicionar/marcar/remover), pro card por fora mostrar em tempo real. */
  onProgressChange?: (progress: { done: number; total: number }) => void;
}

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
 * Só adicionar/marcar/remover — sem arrastar, sem sub-item, sem renomear (isso
 * continua no `ChecklistSection.tsx`, dentro do modal de detalhes).
 */
export default function InlineChecklist({ cardId, onProgressChange }: InlineChecklistProps) {
  const { items, loading, create, toggle, remove } = useCardChecklist(cardId);
  const [newTitle, setNewTitle] = useState('');

  const flat = flattenWithDepth(buildChecklistTree(items));

  useEffect(() => {
    if (loading) return;
    onProgressChange?.({ done: items.filter((i) => i.checked).length, total: items.length });
  }, [items, loading, onProgressChange]);

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await create(newTitle.trim());
    setNewTitle('');
  }

  if (loading) return <p style={{ fontSize: 11, color: '#bbb', margin: '4px 0' }}>Carregando...</p>;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ marginTop: 2, marginBottom: 4 }}
    >
      {flat.map(({ node, depth }) => (
        <div key={node.id} style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: depth * 14, padding: '2px 0' }}>
          <input
            type="checkbox"
            checked={node.checked}
            onChange={(e) => toggle(node.id, e.target.checked)}
            style={{ flexShrink: 0, cursor: 'pointer' }}
          />
          <span
            style={{
              flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textDecoration: node.checked ? 'line-through' : 'none', color: node.checked ? '#999' : '#333',
            }}
          >
            {node.title}
          </span>
          <button
            onClick={() => remove(node.id)}
            title="Remover"
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 10, flexShrink: 0, padding: '0 2px' }}
          >
            ✕
          </button>
        </div>
      ))}

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

