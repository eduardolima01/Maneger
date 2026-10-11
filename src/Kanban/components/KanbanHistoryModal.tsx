import { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import { getHistory, jumpTo, undoOne, redoOne, clearHistory, subscribeHistory, type HistBucket } from '@/Kanban/api/kanbanHistory';

interface KanbanHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  kanbanId: string;
}

function pad(n: number): string { return String(n).padStart(2, '0'); }
function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const hms = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? `hoje ${hms}` : `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hms}`;
}

const BTN_CLS = 'border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700';

export default function KanbanHistoryModal({ isOpen, onClose, kanbanId }: KanbanHistoryModalProps) {
  const [bucket, setBucket] = useState<HistBucket>({ entries: [], pointer: 0 });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBucket(await getHistory(kanbanId));
  }, [kanbanId]);

  useEffect(() => {
    if (!isOpen) return;
    void refresh();
    setConfirmClear(false);
    return subscribeHistory(() => { void refresh(); }); // atualiza ao vivo (outras alterações, R, Alt+R)
  }, [isOpen, refresh]);

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const { entries, pointer } = bucket;
  const rows = entries.map((entry, index) => ({ entry, index })).reverse(); // mais nova primeiro

  return (
    <Modal open={isOpen} onClose={onClose} title="🕘 Histórico de alterações">
      <div className="text-neutral-900 dark:text-neutral-100" style={{ padding: 16, width: 600, maxWidth: '94vw', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" disabled={busy || pointer === 0} onClick={() => run(() => undoOne(kanbanId))}>↶ Desfazer (R)</Button>
          <Button variant="secondary" disabled={busy || pointer >= entries.length} onClick={() => run(() => redoOne(kanbanId))}>↷ Refazer (Alt+R)</Button>
          <span style={{ flex: 1 }} />
          {!confirmClear ? (
            <Button variant="secondary" disabled={busy || entries.length === 0} onClick={() => setConfirmClear(true)}>🗑 Limpar histórico</Button>
          ) : (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
              Apagar o histórico?
              <Button variant="danger" onClick={() => run(async () => { await clearHistory(kanbanId); setConfirmClear(false); })}>Apagar</Button>
              <Button variant="secondary" onClick={() => setConfirmClear(false)}>Cancelar</Button>
            </span>
          )}
        </div>

        <p className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, margin: 0 }}>
          Guarda as últimas {200} alterações de cards, grupos, colunas e checklists deste kanban (anexos e capas em disco não são restaurados).
          Desfazer uma alteração antiga sobrescreve o que foi feito depois nos mesmos campos.
        </p>

        <div style={{ maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.length === 0 && (
            <p className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 13, textAlign: 'center', padding: 24, margin: 0 }}>
              Nenhuma alteração registrada ainda.
            </p>
          )}
          {rows.map(({ entry, index }, i) => {
            const applied = index < pointer;
            const isOpen = expanded.has(entry.id);
            const showMarker = i > 0 && index === pointer - 1; // linha "você está aqui" entre as desfeitas (acima) e as aplicadas (abaixo)
            return (
              <div key={entry.id}>
                {showMarker && (
                  <div className="text-blue-600 dark:text-blue-400" style={{ fontSize: 10, textAlign: 'center', padding: '2px 0', borderTop: '1px dashed currentColor' }}>
                    estado atual
                  </div>
                )}
                <div
                  className="border border-neutral-200 dark:border-neutral-700"
                  style={{ borderRadius: 6, padding: '6px 8px', opacity: applied ? 1 : 0.5, background: applied ? undefined : 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span title={applied ? 'Aplicada' : 'Desfeita'} style={{ fontSize: 12, marginTop: 1 }}>{applied ? '✓' : '↶'}</span>
                    <button
                      type="button"
                      onClick={() => toggle(entry.id)}
                      style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, minWidth: 0 }}
                    >
                      <div style={{ fontSize: 13, textDecoration: applied ? undefined : 'line-through' }}>{entry.desc}</div>
                      <div className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 10 }}>
                        {formatTime(entry.ts)}{entry.changes.length > 1 ? ` · ${entry.changes.length} alterações` : ''}
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => jumpTo(kanbanId, applied ? index : index + 1))}
                      title={applied ? 'Desfaz esta alteração e todas as mais novas' : 'Refaz esta alteração e todas as mais antigas desfeitas'}
                      className={BTN_CLS}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {applied ? '↶ Voltar até antes' : '↷ Refazer até aqui'}
                    </button>
                  </div>
                  {isOpen && (
                    <ul className="text-neutral-600 dark:text-neutral-300" style={{ fontSize: 11, margin: '6px 0 0 20px', padding: 0, listStyle: 'disc' }}>
                      {entry.changes.slice(0, 50).map((ch, k) => <li key={k}>{ch.text}</li>)}
                      {entry.changes.length > 50 && <li>… e mais {entry.changes.length - 50}</li>}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}
