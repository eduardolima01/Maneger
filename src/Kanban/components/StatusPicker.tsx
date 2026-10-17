import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { STATUS_COLORS, STATUS_LABELS, type TaskStatus } from '@/types/kanban.types';
import { addCustomStatus, statusIds, statusKeyMap, statusKeyOf, useStatusRegistryTick } from '@/Kanban/utils/customStatuses';

/** Opções, na ordem em que aparecem (estados de fábrica + criados pelo usuário); `null` = sem status. */
const getOptions = (): Array<TaskStatus | null> => [...statusIds(), null];

/** Tecla de atalho de cada opção (fora W/A/S/D, que navegam): aperta a letra com o menu aberto e já escolhe. */
const KEY_OF = (opt: TaskStatus | null): string => statusKeyOf(opt).toUpperCase();

/** Só UM menu de status existe por vez: abrir outro fecha o anterior, e só o mais novo responde ao teclado. */
let activeMenu: { id: symbol; close: () => void } | null = null;

const stop = (e: React.SyntheticEvent) => e.stopPropagation();
const PANEL_CLS = 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-600';

function Dot({ status }: { status: TaskStatus | null }) {
  return status
    ? <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: STATUS_COLORS[status] ?? '#9e9e9e', flexShrink: 0 }} />
    : <span className="border border-neutral-400 dark:border-neutral-500" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />;
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Menu de status aberto pelo atalho (T): navega com W/S (ou setas), D/Enter/Espaço escolhe, A/Esc fecha.
 * Fecha ao escolher, ao clicar fora e ao apertar Esc. Enquanto está aberto, nenhuma outra tecla vira atalho.
 * ------------------------------------------------------------------------------------------------------------------- */
export function StatusPickerMenu({ x, y, value, onSelect, onClose, onMouseEnter, onMouseLeave }: {
  x: number;
  y: number;
  value: TaskStatus | null;
  onSelect: (status: TaskStatus | null) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  useStatusRegistryTick();
  const OPTIONS = getOptions();
  const optsRef = useRef(OPTIONS);
  optsRef.current = OPTIONS;
  const [idx, setIdx] = useState(() => Math.max(0, OPTIONS.indexOf(value)));
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const creatingRef = useRef(false);
  creatingRef.current = creating;
  // refs pra o ouvinte de teclado (registrado uma vez) enxergar sempre o valor de agora
  const idxRef = useRef(idx);
  idxRef.current = idx;
  const cbRef = useRef({ onSelect, onClose });
  cbRef.current = { onSelect, onClose };

  // não deixa o menu sair da tela
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: Math.max(4, Math.min(x, window.innerWidth - r.width - 8)), y: Math.max(4, Math.min(y, window.innerHeight - r.height - 8)) });
  }, [x, y]);

  useEffect(() => {
    const me = { id: Symbol('status-menu'), close: () => cbRef.current.onClose() };
    if (activeMenu) activeMenu.close(); // fecha o menu de outro card que tenha ficado aberto
    activeMenu = me;
    function onKey(e: KeyboardEvent) {
      if (activeMenu?.id !== me.id) return;
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return; // digitando o nome de um estado novo
      if (creatingRef.current) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      e.stopPropagation(); // nenhuma outra tecla vira atalho (C, G, W...) enquanto o menu está aberto
      if (k === '+' || k === '=') { e.preventDefault(); setCreating(true); return; } // novo estado
      const keyMap = statusKeyMap();
      if (k in keyMap) { // letra da opção: escolhe direto (ex.: F = Feito)
        e.preventDefault();
        if (e.repeat) return;
        cbRef.current.onSelect(keyMap[k]);
        cbRef.current.onClose();
        return;
      }
      if (k === 'w' || k === 'arrowup') { e.preventDefault(); setIdx((i) => (i - 1 + optsRef.current.length) % optsRef.current.length); return; }
      if (k === 's' || k === 'arrowdown') { e.preventDefault(); setIdx((i) => (i + 1) % optsRef.current.length); return; }
      if (k === 'd' || k === 'enter' || k === ' ' || k === 'arrowright') {
        e.preventDefault();
        if (e.repeat) return;
        cbRef.current.onSelect(optsRef.current[idxRef.current] ?? null);
        cbRef.current.onClose();
        return;
      }
      if (k === 'a' || k === 'escape' || k === 'arrowleft') { e.preventDefault(); cbRef.current.onClose(); }
    }
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cbRef.current.onClose();
    }
    window.addEventListener('keydown', onKey, true); // captura: roda antes dos ouvintes de atalho do quadro/árvore
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      if (activeMenu?.id === me.id) activeMenu = null;
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  return createPortal(
    <div
      ref={ref}
      onClick={stop}
      onDoubleClick={stop}
      onPointerDown={stop}
      onContextMenu={stop}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={PANEL_CLS}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 100000, minWidth: 170, padding: 4, borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.25)' }}
    >
      {OPTIONS.map((opt, i) => (
        <button
          key={opt ?? 'none'}
          type="button"
          onMouseEnter={() => setIdx(i)}
          onClick={() => { onSelect(opt); onClose(); }}
          className={i === idx ? 'bg-blue-100 dark:bg-blue-900' : ''}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 8px', fontSize: 13, border: 'none', borderRadius: 5, cursor: 'pointer', textAlign: 'left', background: i === idx ? undefined : 'transparent', color: 'inherit' }}
        >
          <Dot status={opt} />
          <span style={{ flex: 1 }}>{opt ? STATUS_LABELS[opt] : 'Sem status'}</span>
          {opt === value && <span style={{ fontSize: 11 }}>✓</span>}
          <kbd className="bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-500" style={{ fontSize: 10, fontFamily: 'inherit', fontWeight: 600, minWidth: 16, textAlign: 'center', padding: '0 4px', borderRadius: 4 }}>{KEY_OF(opt)}</kbd>
        </button>
      ))}
      {creating ? (
        <div style={{ display: 'flex', gap: 4, padding: '4px 4px 2px' }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do novo estado…"
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') { e.preventDefault(); setCreating(false); setNewName(''); }
              if (e.key === 'Enter') {
                e.preventDefault();
                const id = addCustomStatus(newName);
                if (id) { cbRef.current.onSelect(id); cbRef.current.onClose(); }
              }
            }}
            className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-blue-400 dark:border-blue-500 dark:[color-scheme:dark]"
            style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '2px 6px', borderRadius: 4, outline: 'none' }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="text-blue-700 dark:text-blue-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 8px', marginTop: 2, fontSize: 12, border: 'none', borderTop: '1px solid rgba(128,128,128,0.25)', borderRadius: 5, cursor: 'pointer', textAlign: 'left', background: 'transparent' }}
        >
          <span style={{ flex: 1 }}>＋ Novo estado</span>
          <kbd className="bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-500" style={{ fontSize: 10, fontFamily: 'inherit', fontWeight: 600, minWidth: 16, textAlign: 'center', padding: '0 4px', borderRadius: 4 }}>+</kbd>
        </button>
      )}
      <div className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 10, padding: '4px 8px 2px' }}>W/S navegar · D escolher · A fechar · ou a letra</div>
    </div>,
    document.body
  );
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Passar o mouse por cima do status mostra as opções logo abaixo; clicar numa troca o status.
 * Clicar no próprio status (ex.: abrir o <select> nativo) fecha a lista.
 * ------------------------------------------------------------------------------------------------------------------- */
export function StatusHoverPicker({ value, onSelect, children }: {
  value: TaskStatus | null;
  onSelect: (status: TaskStatus | null) => void;
  children: React.ReactNode;
}) {
  useStatusRegistryTick();
  const OPTIONS = getOptions();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }
  function scheduleOpen() {
    clearTimers();
    if (pos) return;
    openTimer.current = setTimeout(() => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const height = getOptions().length * 26 + 8;
      setPos({ x: r.left, y: r.bottom + height + 6 > window.innerHeight ? Math.max(4, r.top - height - 2) : r.bottom + 2 });
    }, 200);
  }
  function scheduleClose() {
    clearTimers();
    closeTimer.current = setTimeout(() => setPos(null), 150);
  }
  function closeNow() { clearTimers(); setPos(null); }
  useEffect(() => clearTimers, []);

  // com a lista aberta, a letra de cada opção também escolhe (mesmas teclas do menu do atalho T)
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const isOpen = pos !== null;
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (activeMenu) return; // o menu do atalho T está aberto: é ele que responde
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { e.preventDefault(); closeNow(); return; }
      const keyMap = statusKeyMap();
      if (!(k in keyMap)) return;
      e.preventDefault();
      e.stopPropagation();
      onSelectRef.current(keyMap[k]);
      closeNow();
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen]);

  return (
    <>
      <span ref={triggerRef} onMouseEnter={scheduleOpen} onMouseLeave={scheduleClose} onMouseDown={closeNow} style={{ display: 'inline-flex' }}>
        {children}
      </span>
      {pos && createPortal(
        <div
          onClick={stop}
          onDoubleClick={stop}
          onPointerDown={stop}
          onContextMenu={stop}
          onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); }}
          onMouseLeave={scheduleClose}
          className={PANEL_CLS}
          style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 100000, padding: 3, borderRadius: 6, boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt ?? 'none'}
              type="button"
              onClick={() => { onSelect(opt); closeNow(); }}
              className="hover:bg-neutral-100 dark:hover:bg-neutral-700"
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', height: 26, padding: '0 8px', fontSize: 12, border: 'none', borderRadius: 4, cursor: 'pointer', textAlign: 'left', background: 'transparent', color: 'inherit', whiteSpace: 'nowrap' }}
            >
              <Dot status={opt} />
              <span style={{ flex: 1 }}>{opt ? STATUS_LABELS[opt] : 'Sem status'}</span>
              {opt === value && <span style={{ fontSize: 10 }}>✓</span>}
              <kbd className="bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-500" style={{ fontSize: 10, fontFamily: 'inherit', fontWeight: 600, minWidth: 15, textAlign: 'center', padding: '0 3px', borderRadius: 4 }}>{KEY_OF(opt)}</kbd>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
