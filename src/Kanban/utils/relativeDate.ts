export interface RelativeDue {
  /** Texto curto: "hoje", "falta 1 dia", "faltam 3 dias", "há 1 dia", "há 2 meses"... */
  label: string;
  /** Diferença em dias inteiros até a data (negativo = já passou). NaN se a data for inválida. */
  diffDays: number;
  /** Data completa pra tooltip: "Prazo: 25/08/2026". */
  title: string;
}

function unit(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Formata uma data "YYYY-MM-DD" (vinda de <input type="date">) em relação a hoje.
 * Compara só o DIA (ignora hora e fuso): usa Date.UTC dos componentes, então não há risco de a data virar o dia
 * anterior/seguinte. Até 59 dias mostra em dias; depois em meses (aprox. 30 dias) e, a partir de 1 ano, em anos.
 */
export function getRelativeDue(dueDate: string, now: Date = new Date()): RelativeDue {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDate);
  if (!m) return { label: dueDate, diffDays: NaN, title: dueDate };

  const dueUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dueUtc - todayUtc) / 86400000);
  const title = `Prazo: ${m[3]}/${m[2]}/${m[1]}`;

  if (diffDays === 0) return { label: 'hoje', diffDays, title };

  const abs = Math.abs(diffDays);
  let n: number;
  let span: string;
  if (abs < 60) {
    n = abs;
    span = unit(n, 'dia', 'dias');
  } else if (abs < 365) {
    n = Math.round(abs / 30);
    span = unit(n, 'mês', 'meses');
  } else {
    n = Math.floor(abs / 365);
    span = unit(n, 'ano', 'anos');
  }

  const label = diffDays > 0 ? `${n === 1 ? 'falta' : 'faltam'} ${span}` : `há ${span}`;
  return { label, diffDays, title };
}
