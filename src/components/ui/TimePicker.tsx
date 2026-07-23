import { useEffect, useRef, useState } from 'react';
import Button from '@/components/layout/Button';

interface TimePickerProps {
  value: string; // 'HH:mm'
  onChange: (value: string) => void;
}

type Mode = 'hour' | 'minute';

function parseTime(value: string): { h: number; m: number } {
  const [h, m] = value.split(':').map(Number);
  return { h: h || 0, m: m || 0 };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// posições em torno do relógio: p=0 no topo (12h / 00h), sentido horário
function polarPosition(p: number, radius: number, cx: number, cy: number) {
  const angle = (p * 30 - 90) * (Math.PI / 180);
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

const CX = 100;
const CY = 100;
const OUTER_RADIUS = 78;
const INNER_RADIUS = 50;
const MINUTE_RADIUS = 78;

export default function TimePicker({ value, onChange }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('hour');
  const [draftH, setDraftH] = useState(0);
  const [draftM, setDraftM] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function open() {
    const { h, m } = parseTime(value);
    setDraftH(h);
    setDraftM(m);
    setMode('hour');
    setIsOpen(true);
  }

  function selectHour(h: number) {
    setDraftH(h);
    setMode('minute'); // avança automaticamente pro minuto, igual Android
  }

  function selectMinute(m: number) {
    setDraftM(m);
  }

  function confirm() {
    onChange(`${pad(draftH)}:${pad(draftM)}`);
    setIsOpen(false);
  }

  function cancel() {
    setIsOpen(false);
  }

  // anel externo: horas 1–12 | anel interno: 00 e 13–23
  const outerNumbers = Array.from({ length: 12 }, (_, p) => ({ p, value: p === 0 ? 12 : p }));
  const innerNumbers = Array.from({ length: 12 }, (_, p) => ({ p, value: p === 0 ? 0 : 12 + p }));
  const minuteNumbers = Array.from({ length: 12 }, (_, p) => ({ p, value: p * 5 }));

  const selectedHourIsOuter = draftH === 12 || (draftH >= 1 && draftH <= 11);
  const selectedP =
    mode === 'hour'
      ? selectedHourIsOuter
        ? draftH === 12 ? 0 : draftH
        : draftH === 0 ? 0 : draftH - 12
      : Math.round(draftM / 5) % 12;
  const selectedRadius = mode === 'hour' ? (selectedHourIsOuter ? OUTER_RADIUS : INNER_RADIUS) : MINUTE_RADIUS;
  const handPos = polarPosition(selectedP, selectedRadius, CX, CY);

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div
        onClick={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 2, border: '1px solid #ccc', borderRadius: 4,
          padding: '6px 10px', cursor: 'pointer', fontSize: 14, fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>{value || '00:00'}</span>
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} style={{ marginLeft: 4, color: '#666' }}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 30,
            backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            width: 240, padding: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 2, marginBottom: 12, backgroundColor: '#1a73e8', borderRadius: 6, padding: '10px 0' }}>
            <span
              onClick={() => setMode('hour')}
              style={{
                fontSize: 28, fontWeight: 600, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                backgroundColor: mode === 'hour' ? 'rgba(255,255,255,0.25)' : 'transparent',
                color: '#fff',
              }}
            >
              {pad(draftH)}
            </span>
            <span style={{ fontSize: 28, fontWeight: 600, color: '#fff' }}>:</span>
            <span
              onClick={() => setMode('minute')}
              style={{
                fontSize: 28, fontWeight: 600, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                backgroundColor: mode === 'minute' ? 'rgba(255,255,255,0.25)' : 'transparent',
                color: mode === 'minute' ? '#fff' : 'rgba(255,255,255,0.75)',
              }}
            >
              {pad(draftM)}
            </span>
          </div>

          <svg viewBox="0 0 200 200" width="100%" height="auto" style={{ display: 'block', margin: '0 auto' }}>
            <circle cx={CX} cy={CY} r={90} fill="#f1f3f4" />

            <line x1={CX} y1={CY} x2={handPos.x} y2={handPos.y} stroke="#1a73e8" strokeWidth={2} />
            <circle cx={CX} cy={CY} r={3} fill="#1a73e8" />
            <circle cx={handPos.x} cy={handPos.y} r={16} fill="#1a73e8" />

            {mode === 'hour' &&
              outerNumbers.map(({ p, value: v }) => {
                const pos = polarPosition(p, OUTER_RADIUS, CX, CY);
                const isSelected = selectedHourIsOuter && draftH === v;
                return (
                  <text
                    key={`outer-${v}`}
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    onClick={() => selectHour(v)}
                    style={{ cursor: 'pointer', fontSize: 15, fontWeight: isSelected ? 700 : 400, fill: isSelected ? '#fff' : '#333', userSelect: 'none' }}
                  >
                    {v}
                  </text>
                );
              })}

            {mode === 'hour' &&
              innerNumbers.map(({ p, value: v }) => {
                const pos = polarPosition(p, INNER_RADIUS, CX, CY);
                const isSelected = !selectedHourIsOuter && draftH === v;
                return (
                  <text
                    key={`inner-${v}`}
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    onClick={() => selectHour(v)}
                    style={{ cursor: 'pointer', fontSize: 12, fontWeight: isSelected ? 700 : 400, fill: isSelected ? '#fff' : '#888', userSelect: 'none' }}
                  >
                    {pad(v)}
                  </text>
                );
              })}

            {mode === 'minute' &&
              minuteNumbers.map(({ p, value: v }) => {
                const pos = polarPosition(p, MINUTE_RADIUS, CX, CY);
                const isSelected = draftM === v;
                return (
                  <text
                    key={`min-${v}`}
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    onClick={() => selectMinute(v)}
                    style={{ cursor: 'pointer', fontSize: 15, fontWeight: isSelected ? 700 : 400, fill: isSelected ? '#fff' : '#333', userSelect: 'none' }}
                  >
                    {pad(v)}
                  </text>
                );
              })}
          </svg>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
            <Button variant="secondary" onClick={cancel}>Cancelar</Button>
            <Button variant="primary" onClick={confirm}>OK</Button>
          </div>
        </div>
      )}
    </div>
  );
}
