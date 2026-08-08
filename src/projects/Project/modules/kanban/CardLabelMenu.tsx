import { parseLabel, LABEL_COLOR_PALETTE, type ParsedLabel } from '@/Kanban/utils/kanbanLabels';
import { useEffect, useRef, useState } from 'react';

interface CardLabelMenuProps {
  x: number;
  y: number;
  cardLabels: string[];
  allLabels: ParsedLabel[];
  onToggle: (name: string, color: string, isGroup: boolean) => void;
  onCreate: (name: string, color: string, isGroup: boolean) => void;
  onClose: () => void;
}

export default function CardLabelMenu({ x, y, cardLabels, allLabels, onToggle, onCreate, onClose }: CardLabelMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LABEL_COLOR_PALETTE[0]);
  const [newIsGroup, setNewIsGroup] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const cardLabelNames = new Set(cardLabels.map((raw) => parseLabel(raw).name));

  function submitCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreate(trimmed, newColor, newIsGroup);
    setNewName('');
    setNewIsGroup(false);
    setCreating(false);
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', top: y, left: x, backgroundColor: '#fff', border: '1px solid #ddd',
        borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', zIndex: 1000, minWidth: 200, padding: 6,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: '#999', padding: '4px 6px' }}>ETIQUETAS</div>

      {allLabels.length === 0 && !creating && (
        <div style={{ fontSize: 12, color: '#999', padding: '4px 6px' }}>Nenhuma etiqueta ainda.</div>
      )}

      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {allLabels.map(({ name, color, isGroup }) => {
          const checked = cardLabelNames.has(name);
          return (
            <button
              key={name}
              onClick={() => onToggle(name, color, isGroup)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                padding: '6px 6px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              {isGroup && <span title="Etiqueta de grupo" style={{ fontSize: 10 }}>🏷</span>}
              {checked && <span style={{ fontSize: 12, color: '#1a73e8' }}>✓</span>}
            </button>
          );
        })}
      </div>

      <div style={{ borderTop: '1px solid #eee', marginTop: 4, paddingTop: 4 }}>
        {creating ? (
          <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitCreate()}
              placeholder="Nome da etiqueta..."
              style={{ fontSize: 12, padding: 6, border: '1px solid #ddd', borderRadius: 4 }}
            />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {LABEL_COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  style={{
                    width: 18, height: 18, borderRadius: 4, backgroundColor: c, cursor: 'pointer',
                    border: newColor === c ? '2px solid #000' : '1px solid rgba(0,0,0,0.15)', padding: 0,
                  }}
                />
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={newIsGroup} onChange={(e) => setNewIsGroup(e.target.checked)} />
              🏷 É uma etiqueta de grupo (agrupa cards na coluna)
            </label>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setCreating(false); setNewName(''); }}
                style={{ fontSize: 12, padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', color: '#666' }}
              >
                Cancelar
              </button>
              <button
                onClick={submitCreate}
                disabled={!newName.trim()}
                style={{
                  fontSize: 12, padding: '4px 10px', border: 'none', borderRadius: 4,
                  backgroundColor: newName.trim() ? '#1a73e8' : '#ccc', color: '#fff',
                  cursor: newName.trim() ? 'pointer' : 'default',
                }}
              >
                Criar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            style={{ width: '100%', textAlign: 'left', padding: '6px 6px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', color: '#1a73e8', borderRadius: 4 }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            + Nova etiqueta
          </button>
        )}
      </div>
    </div>
  );
}
