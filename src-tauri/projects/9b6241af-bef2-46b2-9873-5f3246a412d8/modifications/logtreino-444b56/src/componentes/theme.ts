// componentes/theme.ts
// Tokens de cor e estilos inline reutilizados por toda a Modificação.
// Sem CSS externo/Tailwind — o runtime não garante nenhuma classe disponível.

const colors = {
  bg: '#0f1115',
  card: '#181b21',
  cardAlt: '#1f232b',
  border: '#2a2f3a',
  text: '#e8eaed',
  textDim: '#9aa1ac',
  accent: '#5b8cff',
  accentDim: '#2a3a66',
  green: '#4ade80',
  red: '#f87171',
  amber: '#fbbf24',
};

function buildStyles() {
  return {
    root: { color: colors.text, background: colors.bg, minHeight: '100%', padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
    h1: { margin: '0 0 4px', fontSize: 20, fontWeight: 700 },
    h2: { margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: colors.text },
    small: { fontSize: 12, color: colors.textDim },
    tabBar: { display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
    tabBtn: (active: boolean) => ({
      padding: '8px 12px', borderRadius: 8, border: '1px solid ' + (active ? colors.accent : colors.border),
      background: active ? colors.accentDim : colors.card, color: active ? '#cfe0ff' : colors.textDim,
      cursor: 'pointer', fontSize: 13, fontWeight: 600,
    }),
    card: { background: colors.card, border: '1px solid ' + colors.border, borderRadius: 12, padding: 14, marginBottom: 12 },
    cardAlt: { background: colors.cardAlt, border: '1px solid ' + colors.border, borderRadius: 10, padding: 10, marginBottom: 8 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 },
    statNum: { fontSize: 22, fontWeight: 700, color: colors.text },
    statLabel: { fontSize: 12, color: colors.textDim, marginTop: 2 },
    input: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid ' + colors.border, background: '#11141a', color: colors.text, fontSize: 13, marginBottom: 8 },
    label: { fontSize: 12, color: colors.textDim, marginBottom: 4, display: 'block' },
    btn: { padding: '8px 14px', borderRadius: 8, border: 'none', background: colors.accent, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
    btnGhost: { padding: '8px 14px', borderRadius: 8, border: '1px solid ' + colors.border, background: 'transparent', color: colors.text, fontSize: 13, cursor: 'pointer' },
    btnDanger: { padding: '6px 10px', borderRadius: 8, border: '1px solid ' + colors.red, background: 'transparent', color: colors.red, fontSize: 12, cursor: 'pointer' },
    btnSmall: { padding: '5px 9px', borderRadius: 7, border: '1px solid ' + colors.border, background: colors.cardAlt, color: colors.text, fontSize: 12, cursor: 'pointer' },
    row: { display: 'flex', gap: 8, alignItems: 'center' },
    badge: { fontSize: 11, padding: '2px 8px', borderRadius: 999, background: colors.accentDim, color: '#cfe0ff', display: 'inline-block' },
    setRow: { display: 'grid', gridTemplateColumns: '28px 1fr 1fr 1fr 1fr 28px', gap: 6, alignItems: 'center', marginBottom: 6 },
    link: { color: colors.accent, cursor: 'pointer', textDecoration: 'none', fontWeight: 600 },
    colors,
  };
}
