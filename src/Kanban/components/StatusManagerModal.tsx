import { useState } from 'react';
import { createPortal } from 'react-dom';
import { STATUS_COLORS, STATUS_LABELS } from '@/types/kanban.types';
import {
  BUILTIN_STATUS_IDS, addCustomStatus, listCustomStatuses, removeCustomStatus, statusKeyOf, updateCustomStatus, useStatusRegistryTick,
} from '@/Kanban/utils/customStatuses';

const FIELD_CLS = 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 dark:[color-scheme:dark]';

/** Gerenciar os estados dos cards: ver os de fábrica, criar, renomear, trocar a cor e apagar os seus. */
export default function StatusManagerModal({ onClose, onRemoved }: {
  onClose: () => void;
  /** Chamado ao apagar um estado, pra o quadro tirar o estado dos cards que o usavam. */
  onRemoved: (id: string) => void;
}) {
  useStatusRegistryTick();
  const [name, setName] = useState('');
  const customs = listCustomStatuses();

  function add() {
    if (addCustomStatus(name)) setName('');
  }

  const kbd = (k: string) => (
    <kbd className="bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-500" style={{ fontSize: 10, fontFamily: 'inherit', fontWeight: 600, minWidth: 16, textAlign: 'center', padding: '0 4px', borderRadius: 4 }}>{k.toUpperCase()}</kbd>
  );

  return createPortal(
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100002, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}
        className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-600"
        style={{ width: 420, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto', borderRadius: 10, padding: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, flex: 1 }}>🏷 Estados dos cards</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: 'inherit' }}>✕</button>
        </div>
        <p className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, margin: '0 0 10px' }}>
          Os estados criados aparecem como opção em todos os cards deste kanban. Com o menu de estado aberto (T), a letra ao lado escolhe o estado.
        </p>

        {BUILTIN_STATUS_IDS.map((id) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[id] }} />
            <span style={{ flex: 1 }}>{STATUS_LABELS[id]}</span>
            <span className="text-neutral-400" style={{ fontSize: 11 }}>de fábrica</span>
            {kbd(statusKeyOf(id))}
          </div>
        ))}

        <div className="border-t border-neutral-200 dark:border-neutral-700" style={{ margin: '8px 0' }} />

        {customs.length === 0 && <p className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12, margin: '4px 0 8px' }}>Nenhum estado criado ainda.</p>}
        {customs.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <input type="color" value={c.color} onChange={(e) => updateCustomStatus(c.id, { color: e.target.value })} title="Cor" style={{ width: 26, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
            <input
              defaultValue={c.label}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.label) updateCustomStatus(c.id, { label: v }); else e.target.value = c.label; }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className={FIELD_CLS}
              style={{ flex: 1, minWidth: 0, fontSize: 13, padding: '2px 6px', borderRadius: 4 }}
            />
            {c.key && kbd(c.key)}
            <button
              type="button"
              title="Apagar o estado (os cards que o usam ficam sem estado)"
              onClick={() => { if (window.confirm(`Apagar o estado "${c.label}"? Os cards que o usam ficam sem estado.`)) { onRemoved(c.id); removeCustomStatus(c.id); } }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'inherit' }}
            >🗑</button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder="Novo estado…"
            className={FIELD_CLS}
            style={{ flex: 1, minWidth: 0, fontSize: 13, padding: '4px 8px', borderRadius: 6 }}
          />
          <button type="button" onClick={add} className="bg-blue-600 hover:bg-blue-700 text-white" style={{ border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 6 }}>＋ Adicionar</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
