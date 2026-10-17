// componentes/Tabs.tsx
// "React" continua vindo via props (não existe import no runtime) — o
// transform de JSX do sucrase gera chamadas a React.createElement, então
// o identificador "React" precisa estar no escopo de cada arquivo com JSX.
function Tabs({ React, s, tabs, active, onChange }: any) {
  return (
    <div style={s.tabBar}>
      {tabs.map((t: any) => (
        <button key={t.key} style={s.tabBtn(active === t.key)} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
