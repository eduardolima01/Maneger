export interface CardTimerSession {
  id: string;
  startAt: string; // ISO
  endAt: string;   // ISO
  durationSeconds: number; // autoritativo — pode ser editado depois, independente de start/end
  manual?: boolean; // true = veio de "+/- tempo", não de um play→pausa real
  title?: string;
  description?: string;
}

export interface CardTimerData {
  sessionsByCard: Record<string, CardTimerSession[]>;
}

export function defaultCardTimerData(): CardTimerData {
  return { sessionsByCard: {} };
}
