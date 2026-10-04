import { parseLabel, LABEL_COLOR_PALETTE, type ParsedLabel } from '@/Kanban/utils/kanbanLabels';
import { useEffect, useRef, useState } from 'react';
import type { LabelIcon } from '@/types/kanban.types';
import { useLabelIcons } from '../hooks/Labeliconcontext';
import LabelIconBadge from './LabelIconBadge';
import LabelIconPicker from './LabelIconPicker';

interface CardLabelMenuProps {
  x: number;
  y: number;
  cardLabels: string[];
  allLabels: ParsedLabel[];
  onToggle: (name: string, color: string, isGroup: boolean) => void;
  onCreate: (name: string, color: string, isGroup: boolean) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onReorder?: (nextLabels: string[]) => void;
}

const FAINT_CLS = 'text-neutral-400 dark:text-neutral-500';
const INPUT_CLS = 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600';
const ROW_HOVER_CLS = 'hover:bg-neutral-100 dark:hover:bg-neutral-700';

export default function CardLabelMenu({ x, y, cardLabels, allLabels, onToggle, onCreate, onClose, onMouseEnter, onMouseLeave, onReorder }: CardLabelMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LABEL_COLOR_PALETTE[0]);
  const [newIsGroup, setNewIsGroup] = useState(false);
  const [newIcon, setNewIcon] = useState<LabelIcon | null>(null);
  const { icons, setIcon } = useLabelIcons();
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const draggingRef = useRef<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);

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

  function commitReorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || !onReorder) return;
    const next = [...cardLabels];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onReorder(next);
  }

  function handleDragHandleMouseDown(index: number) {
    draggingRef.current = index;
    setDragIndex(index);

    function onMouseMove(e: MouseEvent) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const row = el?.closest<HTMLElement>('[data-label-row-index]');
      if (!row) return;
      const idx = Number(row.dataset.labelRowIndex);
      hoverIndexRef.current = idx;
      setHoverIndex(idx);
    }

    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      const from = draggingRef.current;
      const to = hoverIndexRef.current;
      draggingRef.current = null;
      setDragIndex(null);
      setHoverIndex(null);
      if (from !== null && to !== null) commitReorder(from, to);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
  function submitCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const alreadyExists = allLabels.some((l) => l.name === trimmed); // criar uma que já existe só marca — não troca o ícone dela
    onCreate(trimmed, newColor, newIsGroup);
    if (newIcon && !alreadyExists) setIcon(trimmed, newIcon);
    setNewName('');
    setNewIsGroup(false);
    setNewIcon(null);
    setCreating(false);
  }

  return (
    <div
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600"
      style={{
        position: 'fixed', top: y, left: x,
        borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', zIndex: 1000, minWidth: 200, padding: 6,
      }}
    >
      {onReorder && cardLabels.length > 0 && (
        <>
          <div className={FAINT_CLS} style={{ fontSize: 11, fontWeight: 600, padding: '4px 6px' }}>
            SUAS ETIQUETAS (arraste para reordenar — a 1ª define a cor do card)
          </div>
          {cardLabels.map((raw, i) => {
            const { name, color } = parseLabel(raw);
            return (
              <div
                key={raw}
                data-label-row-index={i}
                className={hoverIndex === i && dragIndex !== null && dragIndex !== i ? 'bg-indigo-50 dark:bg-indigo-950' : ''}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 6px', fontSize: 13,
                  borderRadius: 4, opacity: dragIndex === i ? 0.4 : 1,
                }}
              >
                <span
                  onMouseDown={(e) => { e.preventDefault(); handleDragHandleMouseDown(i); }}
                  className={FAINT_CLS}
                  style={{ fontSize: 11, cursor: 'grab' }}
                >
                  ⠿
                </span>
                <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, flexShrink: 0 }} />
                <LabelIconBadge icon={icons[name]} size={13} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                {i === 0 && <span title="Define a cor do card" style={{ fontSize: 11 }}>🎨</span>}
              </div>
            );
          })}
          <div className="border-t border-neutral-200 dark:border-neutral-700" style={{ margin: '4px 0' }} />
        </>
      )}

      <div className={FAINT_CLS} style={{ fontSize: 11, fontWeight: 600, padding: '4px 6px' }}>ETIQUETAS</div>

      {allLabels.length === 0 && !creating && (
        <div className={FAINT_CLS} style={{ fontSize: 12, padding: '4px 6px' }}>Nenhuma etiqueta ainda.</div>
      )}

      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {allLabels.map(({ name, color, isGroup }) => {
          const checked = cardLabelNames.has(name);
          return (
            <button
              key={name}
              onClick={() => onToggle(name, color, isGroup)}
              className={ROW_HOVER_CLS}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                padding: '6px 6px', fontSize: 13, border: 'none', cursor: 'pointer', borderRadius: 4,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, flexShrink: 0 }} />
              <LabelIconBadge icon={icons[name]} size={13} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              {isGroup && <span title="Etiqueta de grupo" style={{ fontSize: 10 }}>🏷</span>}
              {checked && <span className="text-blue-600 dark:text-blue-400" style={{ fontSize: 12 }}>✓</span>}
            </button>
          );
        })}
      </div>

      <div className="border-t border-neutral-200 dark:border-neutral-700" style={{ marginTop: 4, paddingTop: 4 }}>
        {creating ? (
          <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitCreate()}
              placeholder="Nome da etiqueta..."
              className={INPUT_CLS}
              style={{ fontSize: 12, padding: 6, borderRadius: 4 }}
            />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {LABEL_COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={newColor === c ? 'border-2 border-black dark:border-white' : 'border border-black/15 dark:border-white/25'}
                  style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: c, cursor: 'pointer', padding: 0 }}
                />
              ))}
            </div>
            <div className="text-neutral-600 dark:text-neutral-400" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <LabelIconPicker value={newIcon} onChange={setNewIcon} />
              <span>Ícone (emoji ou imagem, opcional)</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={newIsGroup} onChange={(e) => setNewIsGroup(e.target.checked)} />
              🏷 É uma etiqueta de grupo (agrupa cards na coluna)
            </label>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setCreating(false); setNewName(''); setNewIcon(null); }}
                className="text-neutral-500 dark:text-neutral-400"
                style={{ fontSize: 12, padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={submitCreate}
                disabled={!newName.trim()}
                className={newName.trim() ? 'bg-blue-600 text-white' : 'bg-neutral-300 dark:bg-neutral-600 text-white'}
                style={{
                  fontSize: 12, padding: '4px 10px', border: 'none', borderRadius: 4,
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
            className={`text-blue-600 dark:text-blue-400 ${ROW_HOVER_CLS}`}
            style={{ width: '100%', textAlign: 'left', padding: '6px 6px', fontSize: 13, border: 'none', cursor: 'pointer', borderRadius: 4 }}
          >
            + Nova etiqueta
          </button>
        )}
      </div>
    </div>
  );
}
