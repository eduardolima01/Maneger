import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import EmojiPicker, { EmojiStyle } from 'emoji-picker-react';
import ImageUploadField from '@/components/ImageUploadField';
import type { LabelIcon } from '@/types/kanban.types';
import LabelIconBadge from './LabelIconBadge';

interface LabelIconPickerProps {
  value: LabelIcon | null;
  onChange: (icon: LabelIcon | null) => void;
}

const POPOVER_WIDTH = 300;

/**
 * Botão pequeno que mostra o ícone atual (ou "＋") e abre um popover com duas abas: emoji e imagem.
 * O popover vai por portal + position fixed: quem usa (linha do gerenciador de etiquetas, menu de etiquetas)
 * tem overflow/scroll próprio, que cortaria um popover absoluto.
 */
export default function LabelIconPicker({ value, onChange }: LabelIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'emoji' | 'image'>(value?.kind === 'image' ? 'image' : 'emoji');
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [pos, setPos] = useState({ left: 0, top: 0 });
  // um id novo por picker: cada upload vira um arquivo novo (não sobrescreve o anterior e não sofre com cache de imagem)
  const [uploadId] = useState(() => `label-${Date.now().toString(36)}`);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function toggleOpen() {
    if (open) { setOpen(false); return; }
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) setAnchor({ x: r.left, y: r.bottom + 4 });
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open) return;
    const el = popoverRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(anchor.x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(anchor.y, window.innerHeight - r.height - 8)),
    });
  }, [open, anchor, tab]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // senão o Esc também fecharia o modal/menu por baixo
      setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, fontSize: 12, padding: '5px 0', border: 'none', cursor: 'pointer',
    background: active ? '#e8f0fe' : 'transparent', color: active ? '#1a73e8' : '#555', fontWeight: active ? 600 : 400,
  });

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        title="Ícone da etiqueta (emoji ou imagem)"
        style={{
          width: 24, height: 24, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: value ? '1px solid #ddd' : '1px dashed #bbb', borderRadius: 4, background: '#fff', cursor: 'pointer', padding: 0,
          color: '#888', fontSize: 13,
        }}
      >
        {value ? <LabelIconBadge icon={value} size={16} /> : '＋'}
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          // pára o evento aqui: o menu/modal por baixo fecha em clique "de fora", e este popover está fora deles no DOM (portal)
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', left: pos.left, top: pos.top, zIndex: 30000, width: POPOVER_WIDTH,
            backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.2)', overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
            <button type="button" onClick={() => setTab('emoji')} style={tabStyle(tab === 'emoji')}>😀 Emoji</button>
            <button type="button" onClick={() => setTab('image')} style={tabStyle(tab === 'image')}>🖼️ Imagem</button>
          </div>

          {tab === 'emoji' ? (
            <EmojiPicker
              onEmojiClick={(data) => { onChange({ kind: 'emoji', value: data.emoji }); setOpen(false); }}
              emojiStyle={EmojiStyle.NATIVE}
              width={POPOVER_WIDTH - 2}
              height={340}
              previewConfig={{ showPreview: false }}
              lazyLoadEmojis
            />
          ) : (
            <div style={{ padding: 10 }}>
              <ImageUploadField
                entityId={uploadId}
                currentPath={value?.kind === 'image' ? value.path : null}
                onUploaded={(path) => { onChange({ kind: 'image', path }); setOpen(false); }}
                height={60}
              />
            </div>
          )}

          {value && (
            <div style={{ borderTop: '1px solid #eee', padding: '4px 8px', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); }}
                style={{ fontSize: 11, color: '#c62828', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
              >
                Remover ícone
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
