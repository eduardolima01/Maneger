// componentes/StatCard.tsx
function StatCard({ React, s, value, label }: any) {
  return (
    <div style={s.card}>
      <div style={s.statNum}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}
