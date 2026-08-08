import { useState } from 'react';
import type { KanbanCard as CardType, ChecklistProgress, KanbanDensity } from '@/types/kanban.types';
import { ParsedLabel } from './kanbanLabels';
import KanbanCard from '@/Projects/Project/modules/kanban/KanbanCard';

interface LabelGroupBlockProps {
  name: string;
  color: string;
  cards: CardType[];
  density: KanbanDensity;
  cardsWithSubKanban: Set<string>;
  checklistProgress: Record<string, ChecklistProgress>;
  allLabels: ParsedLabel[];
  onCardClick: (cardId: string) => void;
  onCardDuplicate: (cardId: string) => void;
  onCardRequestDelete: (cardId: string, title: string) => void;
  onUpdateCardLabels: (cardId: string, labels: string[]) => void;
}

export default function LabelGroupBlock({
  name, color, cards, density, cardsWithSubKanban, checklistProgress, allLabels,
  onCardClick, onCardDuplicate, onCardRequestDelete, onUpdateCardLabels,
}: LabelGroupBlockProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ border: '2px dashed #c7c7c7', borderRadius: 6, padding: 6, backgroundColor: '#f5f5f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <button
            onClick={() => setCollapsed((v) => !v)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, color: '#666', padding: 0 }}
          >
            {collapsed ? '▶' : '▼'}
          </button>
          <span title="Subgrupo por etiqueta" style={{ color: '#999', fontSize: 11 }}>🏷</span>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{name}</span>
          <span style={{ fontSize: 10, color: '#999' }}>({cards.length})</span>
        </div>

        {!collapsed && (
          <div style={{ minHeight: 30 }}>
            {cards.map((c) => (
              <KanbanCard
                key={c.id}
                card={c}
                density={density}
                hasSubKanban={cardsWithSubKanban.has(c.id)}
                checklistProgress={checklistProgress[c.id]}
                allLabels={allLabels}
                onClick={() => onCardClick(c.id)}
                onDuplicate={() => onCardDuplicate(c.id)}
                onRequestDelete={() => onCardRequestDelete(c.id, c.title)}
                onUpdateLabels={onUpdateCardLabels}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
