
function toDateOnly(d: Date): string {
  // evita o mesmo problema de fuso já visto no badge de prazo: toISOString() usa UTC e pode
  // empurrar a data um dia pra trás/frente dependendo do horário local
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function generateNumberedTitles(baseTitle: string, count: number, startAt = 1): string[] {
  const titles: string[] = [];
  for (let i = 0; i < count; i++) titles.push(`${baseTitle} ${startAt + i}`);
  return titles;
}

export function generateDailyDates(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(toDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function generateDistributedDates(startDate: string, endDate: string, count: number): string[] {
  if (count <= 1) return [startDate];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const totalMs = end.getTime() - start.getTime();
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = start.getTime() + Math.round((totalMs * i) / (count - 1));
    dates.push(toDateOnly(new Date(t)));
  }
  return dates;
}
