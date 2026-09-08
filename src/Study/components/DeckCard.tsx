import type { CSSProperties, MouseEvent } from 'react';
import type { Deck } from '../types/study.types';

interface DeckCardProps {
  deck: Deck;
  cardCount: number;
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export default function DeckCard({ deck, cardCount, onOpen, onEdit, onDuplicate, onDelete }: DeckCardProps) {
  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div
      onClick={onOpen}
      style={{
        border: '1px solid #e0e0e0',
        borderLeft: `4px solid ${deck.color ?? '#9e9e9e'}`,
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: '#fff',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{deck.icon ?? '📚'}</span>
        <h3 style={{ margin: 0, fontSize: 15, flex: 1 }}>{deck.name}</h3>
      </div>

      {deck.description && (
        <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{deck.description}</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 12, color: '#999' }}>
          {cardCount} {cardCount === 1 ? 'card' : 'cards'}
        </span>
        <div style={{ display: 'flex', gap: 4 }} onClick={stop}>
          <button onClick={onEdit} title="Editar" style={iconBtnStyle}>✎</button>
          <button onClick={onDuplicate} title="Duplicar" style={iconBtnStyle}>⧉</button>
          <button onClick={onDelete} title="Excluir" style={iconBtnStyle}>🗑</button>
        </div>
      </div>
    </div>
  );
}

const iconBtnStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: 14,
  padding: 4,
  borderRadius: 4,
};
