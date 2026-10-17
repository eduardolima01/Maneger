// componentes/SearchInput.tsx
function SearchInput({ React, s, value, onChange, placeholder }: any) {
  return (
    <input
      style={s.input}
      placeholder={placeholder || '🔎 Buscar...'}
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
    />
  );
}
