export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  // sem casas decimais pra B/KB (não faz sentido "3,42 KB" numa listagem), 1 casa daí pra cima
  const decimals = exponent < 2 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
}

export function formatModifiedDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
