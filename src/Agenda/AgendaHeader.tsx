import Button from "@/components/layout/Button";
import { useNow } from '@/lib/hooks/useNow';
import { startOfWeek } from '../lib/utils/date';

export type AgendaViewMode = 'day' | 'week' | 'month';

interface AgendaHeaderProps {
  label: string;
  view: AgendaViewMode;
  onViewChange: (view: AgendaViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Número da semana do ano (não é o padrão ISO-8601, que começa na segunda e
 * usa a semana da primeira quinta-feira) — aqui conta quantas semanas
 * (domingo a sábado, mesmo início de semana usado no resto da Agenda) já
 * se passaram desde a semana que contém 1º de janeiro. Isso é sobre "hoje"
 * de verdade, não sobre a data que está sendo navegada na tela.
 */
function getWeekInfo(today: Date) {
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearEnd = new Date(today.getFullYear(), 11, 31);

  const firstWeekStart = startOfWeek(yearStart);
  const currentWeekStart = startOfWeek(today);
  const lastWeekStart = startOfWeek(yearEnd);

  const weekNumber = Math.round((currentWeekStart.getTime() - firstWeekStart.getTime()) / MS_PER_WEEK) + 1;
  const totalWeeks = Math.round((lastWeekStart.getTime() - firstWeekStart.getTime()) / MS_PER_WEEK) + 1;
  const weeksRemaining = Math.max(0, totalWeeks - weekNumber);

  return { weekNumber, totalWeeks, weeksRemaining };
}

export default function AgendaHeader({ label, view, onViewChange, onPrev, onNext, onToday }: AgendaHeaderProps) {
  const now = useNow();
  const { weekNumber, totalWeeks, weeksRemaining } = getWeekInfo(now);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button variant="secondary" onClick={onToday}>Hoje</Button>
        <button onClick={onPrev} style={navBtnStyle}>‹</button>
        <button onClick={onNext} style={navBtnStyle}>›</button>
        <h2 style={{ marginLeft: 8, fontSize: 18, fontWeight: 600 }}>{label}</h2>
      </div>

      <div
        title={`Semana ${weekNumber} de ${totalWeeks} do ano`}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666',
          backgroundColor: '#f5f5f5', padding: '4px 10px', borderRadius: 12, whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontWeight: 700, color: '#1a73e8' }}>Semana {weekNumber}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>
          {weeksRemaining === 0
            ? 'última semana do ano'
            : `${weeksRemaining} semana${weeksRemaining !== 1 ? 's' : ''} até o fim do ano`}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {(['day', 'week', 'month'] as AgendaViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            style={{
              ...tabBtnStyle,
              backgroundColor: view === v ? '#1a73e8' : 'transparent',
              color: view === v ? '#fff' : '#333',
            }}
          >
            {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
          </button>
        ))}
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  borderRadius: 4,
  background: '#fff',
  color: '#333',
  width: 28,
  height: 28,
  cursor: 'pointer',
};

const tabBtnStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  borderRadius: 4,
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: 14,
};
