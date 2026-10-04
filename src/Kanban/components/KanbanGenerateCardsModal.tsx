import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import type { KanbanColumn } from '@/types/kanban.types';
import { generateDailyDates, generateNumberedTitles } from '@/Kanban/utils/kanbanGenerators';

type Tab = 'numbered' | 'dates';

interface KanbanGenerateCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: KanbanColumn[];
  onGenerate: (columnId: string, titles: string[], dueDates?: (string | null)[]) => Promise<void>;
}

export default function KanbanGenerateCardsModal({ isOpen, onClose, columns, onGenerate }: KanbanGenerateCardsModalProps) {
  const [tab, setTab] = useState<Tab>('numbered');
  const [columnId, setColumnId] = useState(columns[0]?.id ?? '');
  const [baseTitle, setBaseTitle] = useState('Card');
  const [count, setCount] = useState(5);
  const [startAt, setStartAt] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  function resetAndClose() {
    setBaseTitle('Card'); setCount(5); setStartAt(1); setStartDate(''); setEndDate('');
    onClose();
  }

  async function handleGenerate() {
    setSaving(true);
    try {
      if (!columnId) return;
      if (tab === 'numbered') {
        if (count < 1) return;
        const titles = generateNumberedTitles(baseTitle.trim() || 'Card', count, startAt);
        await onGenerate(columnId, titles);
        resetAndClose();
        return;
      }
      if (!startDate || !endDate) return;
      const dueDates = generateDailyDates(startDate, endDate);
      if (dueDates.length === 0) return; // data final antes da inicial
      const titles = generateNumberedTitles(baseTitle.trim() || 'Card', dueDates.length, 1);
      await onGenerate(columnId, titles, dueDates);
      resetAndClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={isOpen} onClose={resetAndClose} title="Gerar cards">
      <div className="text-neutral-900 dark:text-neutral-100" style={{ padding: 16, width: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="border-b border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', gap: 4 }}>
          {(['numbered', 'dates'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? 'border-0 border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-0 border-b-2 border-transparent text-neutral-500 dark:text-neutral-400'
              }
              style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, background: 'none', cursor: 'pointer' }}
            >
              {t === 'numbered' ? 'Numerados' : 'Intervalo de datas'}
            </button>
          ))}
        </div>

        <div>
          <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Coluna</label>
          <select value={columnId} onChange={(e) => setColumnId(e.target.value)} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]" style={{ width: '100%', padding: 6, fontSize: 13 }}>
            {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Título base</label>
          <input value={baseTitle} onChange={(e) => setBaseTitle(e.target.value)} placeholder="Card" className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]" style={{ width: '100%', padding: 6, fontSize: 13 }} />
        </div>

        {tab === 'numbered' && (
          <div>
            <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Quantidade de cards</label>
            <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]" style={{ width: '100%', padding: 6, fontSize: 13 }} />
          </div>
        )}

        {tab === 'numbered' ? (
          <div>
            <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Começar numeração em</label>
            <input type="number" value={startAt} onChange={(e) => setStartAt(Number(e.target.value))} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]" style={{ width: '100%', padding: 6, fontSize: 13 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Data inicial</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]" style={{ width: '100%', padding: 6, fontSize: 13 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Data final</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]" style={{ width: '100%', padding: 6, fontSize: 13 }} />
            </div>
          </div>
        )}

        {tab === 'dates' && startDate && endDate && (
          <p className={generateDailyDates(startDate, endDate).length > 0 ? 'text-neutral-500 dark:text-neutral-400' : 'text-red-600 dark:text-red-400'} style={{ fontSize: 12, margin: 0 }}>
            {generateDailyDates(startDate, endDate).length > 0
              ? `${generateDailyDates(startDate, endDate).length} card(s) serão criados (1 por dia)`
              : 'Data final precisa ser depois da inicial'}
          </p>
        )}

      </div>
      <div className="border-t border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12 }}>
        <Button variant="secondary" onClick={resetAndClose}>Cancelar</Button>
        <Button variant="primary" onClick={handleGenerate} disabled={saving || !columnId}>
          {saving ? 'Gerando...' : 'Gerar'}
        </Button>
      </div>
    </Modal>
  );
}
