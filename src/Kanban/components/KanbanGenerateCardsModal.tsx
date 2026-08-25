
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
      <div style={{ padding: 16, width: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e0e0e0' }}>
          {(['numbered', 'dates'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 12px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid #1a73e8' : '2px solid transparent',
                color: tab === t ? '#1a73e8' : '#666', cursor: 'pointer',
              }}
            >
              {t === 'numbered' ? 'Numerados' : 'Intervalo de datas'}
            </button>
          ))}
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Coluna</label>
          <select value={columnId} onChange={(e) => setColumnId(e.target.value)} style={{ width: '100%', padding: 6, fontSize: 13 }}>
            {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Título base</label>
          <input value={baseTitle} onChange={(e) => setBaseTitle(e.target.value)} placeholder="Card" style={{ width: '100%', padding: 6, fontSize: 13 }} />
        </div>

        {tab === 'numbered' && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Quantidade de cards</label>
            <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: '100%', padding: 6, fontSize: 13 }} />
          </div>
        )}

        {tab === 'numbered' ? (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Começar numeração em</label>
            <input type="number" value={startAt} onChange={(e) => setStartAt(Number(e.target.value))} style={{ width: '100%', padding: 6, fontSize: 13 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Data inicial</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', padding: 6, fontSize: 13 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Data final</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', padding: 6, fontSize: 13 }} />
            </div>
          </div>
        )}

        {tab === 'dates' && startDate && endDate && (
          <p style={{ fontSize: 12, color: generateDailyDates(startDate, endDate).length > 0 ? '#666' : '#c62828', margin: 0 }}>
            {generateDailyDates(startDate, endDate).length > 0
              ? `${generateDailyDates(startDate, endDate).length} card(s) serão criados (1 por dia)`
              : 'Data final precisa ser depois da inicial'}
          </p>
        )}

      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #eee', paddingTop: 12 }}>
        <Button variant="secondary" onClick={resetAndClose}>Cancelar</Button>
        <Button variant="primary" onClick={handleGenerate} disabled={saving || !columnId}>
          {saving ? 'Gerando...' : 'Gerar'}
        </Button>
      </div>
    </Modal>
  );
}
