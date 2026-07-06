import Button from "@/components/layout/Button";

export type AgendaViewMode = 'day' | 'week' | 'month';

interface AgendaHeaderProps {
  label: string;
  view: AgendaViewMode;
  onViewChange: (view: AgendaViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export default function AgendaHeader({ label, view, onViewChange, onPrev, onNext, onToday }: AgendaHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button variant="secondary" onClick={onToday}>Hoje</Button>
        <button onClick={onPrev} style={navBtnStyle}>‹</button>
        <button onClick={onNext} style={navBtnStyle}>›</button>
        <h2 style={{ marginLeft: 8, fontSize: 18, fontWeight: 600 }}>{label}</h2>
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
