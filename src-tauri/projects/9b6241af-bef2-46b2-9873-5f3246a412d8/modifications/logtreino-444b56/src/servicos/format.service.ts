// servicos/format.service.ts
// Funções puras de formatação. Sem dependência de React ou do modApi.

function uid(prefix: string): string {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString('pt-BR');
}

function fmtMin(min: number | null | undefined): string {
  if (min == null) return '-';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? h + 'h ' + m + 'min' : m + 'min';
}
