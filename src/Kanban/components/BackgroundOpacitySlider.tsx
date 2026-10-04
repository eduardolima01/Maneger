import { useEffect, useRef, useState } from 'react';

interface BackgroundOpacitySliderProps {
  /** 0 a 1; 1 = opaco. */
  value: number;
  /** Só dá pra ajustar a opacidade de uma cor ESCOLHIDA (o fundo padrão acompanha o tema e não tem transparência). */
  enabled: boolean;
  onChange: (opacity: number) => void;
}

const COMMIT_DELAY_MS = 350;

/**
 * Controle da opacidade do fundo (0–100%). Arrastar o controle dispara eventos o tempo todo — salvar a cada um faria um
 * save por pixel, então grava só depois que o usuário para de mexer (e, se o painel fechar antes, grava na hora).
 */
export default function BackgroundOpacitySlider({ value, enabled, onChange }: BackgroundOpacitySliderProps) {
  const [draft, setDraft] = useState(Math.round(value * 100));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<number | null>(null); // valor ainda não gravado
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (pendingRef.current === null) setDraft(Math.round(value * 100)); // não atropela um ajuste em andamento
  }, [value]);

  // painel fechado com uma mudança pendente: grava agora em vez de perder
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pendingRef.current !== null) onChangeRef.current(pendingRef.current / 100);
  }, []);

  function schedule(percent: number) {
    setDraft(percent);
    pendingRef.current = percent;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const p = pendingRef.current;
      pendingRef.current = null;
      if (p !== null) onChangeRef.current(p / 100);
    }, COMMIT_DELAY_MS);
  }

  function resetToOpaque() {
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = null;
    setDraft(100);
    onChangeRef.current(1);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, opacity: enabled ? 1 : 0.5 }}>
      <div className="text-neutral-500 dark:text-neutral-400" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10 }}>
        <span>Opacidade do fundo</span>
        <span style={{ fontWeight: 600 }}>{draft}%</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={draft}
          disabled={!enabled}
          onChange={(e) => schedule(Number(e.target.value))}
          title="Opacidade do fundo da coluna"
          style={{ flex: 1, minWidth: 0, cursor: enabled ? 'pointer' : 'default' }}
        />
        <button
          onClick={resetToOpaque}
          disabled={!enabled || draft === 100}
          title="Fundo totalmente opaco (100%)"
          className={!enabled || draft === 100 ? 'text-neutral-400 dark:text-neutral-500' : 'text-blue-600 dark:text-blue-400'}
          style={{ fontSize: 11, background: 'none', border: 'none', padding: 0, cursor: !enabled || draft === 100 ? 'default' : 'pointer' }}
        >
          Opaco
        </button>
      </div>
      {!enabled && (
        <span className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 10 }}>
          Escolha uma cor de fundo acima pra ajustar a opacidade.
        </span>
      )}
    </div>
  );
}
