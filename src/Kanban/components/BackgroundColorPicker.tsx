import { useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { extractDominantColors, tintTowardWhite } from '@/lib/utils/Imagecolors';

/**
 * 6 colunas x 6 linhas. Tudo em hex minúsculo de 7 caracteres (o <input type="color"> só aceita esse formato).
 * Linhas: neutros → pastéis quentes → pastéis frios → pastéis variados → tons médios quentes → tons médios frios.
 * Só tons claros/médios de propósito: o texto do quadro é escuro, então fundo escuro por preset viraria ilegível
 * (quem quiser escuro usa a cor personalizada ou as cores da capa).
 */
const PRESET_COLORS: string[] = [
  '#ffffff', '#f5f5f5', '#eceff1', '#e0e0e0', '#cfd8dc', '#d7ccc8',
  '#ffebee', '#fce4ec', '#fbe9e7', '#fff3e0', '#fff8e1', '#fffde7',
  '#f9fbe7', '#f1f8e9', '#e8f5e9', '#e0f2f1', '#e0f7fa', '#e1f5fe',
  '#e3f2fd', '#e8eaf6', '#ede7f6', '#f3e5f5', '#efebe9', '#f0f4c3',
  '#ef9a9a', '#f48fb1', '#ffab91', '#ffcc80', '#fff59d', '#c5e1a5',
  '#a5d6a7', '#80cbc4', '#80deea', '#81d4fa', '#90caf9', '#ce93d8',
];

const COVER_COLOR_COUNT = 6;   // = número de colunas da grade, pra fechar uma linha certinha
const COVER_TINT_AMOUNT = 0.7; // quanto a versão "suave" das cores da capa é misturada com branco

type CoverState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; colors: string[] };

interface BackgroundColorPickerProps {
  /** Cor atual; null = padrão (sem cor customizada). */
  value: string | null;
  /** Cor que o padrão realmente mostra — só serve pro seletor personalizado começar dela. Hex de 7 caracteres. */
  fallbackColor: string;
  /** Capa do item (coluna/grupo). Se existir, as cores principais dela aparecem como opções separadas. */
  coverPath?: string | null;
  /** null = voltar ao padrão. */
  onChange: (color: string | null) => void;
}

const CUSTOM_COMMIT_DELAY_MS = 350;

function SwatchGrid({ colors, current, onPick }: { colors: string[]; current: string | null; onPick: (c: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 20px)', gap: 4 }}>
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          title={c}
          style={{
            width: 20, height: 20, borderRadius: 4, background: c, cursor: 'pointer', padding: 0,
            border: current === c ? '2px solid #1a73e8' : '1px solid #ccc',
          }}
        />
      ))}
    </div>
  );
}

const smallLabel: React.CSSProperties = { fontSize: 10, color: '#888' };

export default function BackgroundColorPicker({ value, fallbackColor, coverPath, onChange }: BackgroundColorPickerProps) {
  const [draft, setDraft] = useState(value ?? fallbackColor);
  const [coverState, setCoverState] = useState<CoverState>({ status: 'idle' });
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(value ?? fallbackColor);
  }, [value, fallbackColor]);

  useEffect(() => {
    if (!coverPath) {
      setCoverState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setCoverState({ status: 'loading' });
    extractDominantColors(convertFileSrc(coverPath), COVER_COLOR_COUNT)
      .then((colors) => { if (!cancelled) setCoverState({ status: 'ready', colors }); })
      .catch(() => { if (!cancelled) setCoverState({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [coverPath]);

  function cancelPendingCommit() {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = null;
  }

  function pickColor(color: string) {
    cancelPendingCommit();
    onChange(color);
  }

  // O <input type="color"> dispara onChange o tempo todo enquanto o usuário arrasta no seletor — salvar
  // a cada evento faria um save + reload por pixel. Salva só depois que ele para de mexer.
  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setDraft(next);
    cancelPendingCommit();
    commitTimerRef.current = setTimeout(() => onChange(next), CUSTOM_COMMIT_DELAY_MS);
  }

  function resetToDefault() {
    cancelPendingCommit();
    onChange(null);
  }

  const current = value?.toLowerCase() ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {coverPath && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={smallLabel}>Cores da capa</div>
          {coverState.status === 'loading' && <span style={{ fontSize: 11, color: '#999' }}>Lendo cores da capa…</span>}
          {coverState.status === 'error' && <span style={{ fontSize: 11, color: '#999' }}>Não foi possível ler as cores da capa.</span>}
          {coverState.status === 'ready' && coverState.colors.length > 0 && (
            <>
              <SwatchGrid colors={coverState.colors} current={current} onPick={pickColor} />
              <div style={smallLabel}>Versão suave (melhor pra ler o texto)</div>
              <SwatchGrid
                colors={coverState.colors.map((c) => tintTowardWhite(c, COVER_TINT_AMOUNT))}
                current={current}
                onPick={pickColor}
              />
            </>
          )}
          <div style={{ ...smallLabel, marginTop: 2 }}>Paleta</div>
        </div>
      )}

      <SwatchGrid colors={PRESET_COLORS} current={current} onPick={pickColor} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="color"
          value={draft}
          onChange={handleCustomChange}
          title="Cor personalizada"
          style={{ width: 28, height: 22, padding: 0, border: '1px solid #ccc', borderRadius: 4, background: 'none', cursor: 'pointer' }}
        />
        <span style={{ fontSize: 11, color: '#666', flex: 1 }}>Personalizada</span>
        <button
          onClick={resetToDefault}
          disabled={value === null}
          title="Voltar à cor padrão"
          style={{
            fontSize: 11, background: 'none', border: 'none', padding: 0,
            color: value === null ? '#bbb' : '#1a73e8', cursor: value === null ? 'default' : 'pointer',
          }}
        >
          Padrão
        </button>
      </div>
    </div>
  );
}
