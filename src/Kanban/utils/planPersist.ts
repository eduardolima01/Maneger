import { useCallback, useEffect, useRef, useState } from 'react';
import { updateCard } from '@/lib/api/kanban/kanbanCards';
import type { KanbanCard } from '@/types/kanban.types';

/** O que o acompanhamento do plano grava no card: checks por dia e título de cada dia. */
export interface PlanPatch {
  planDayChecks?: Record<string, string[]>;
  planDayTitles?: Record<string, string>;
}

/**
 * Gravação do acompanhamento: mantém uma cópia local (o quadrado muda na hora, sem esperar o arquivo ser regravado e relido)
 * e grava uma vez por vez — cada updateCard lê e regrava o JSON inteiro. Devolve o card já com a cópia local aplicada.
 * Vários pontos da tela (cabeçalho, gráfico, painel do dia) devem usar o MESMO retorno pra não divergirem.
 */
export function usePlanPersist(card: KanbanCard): { card: KanbanCard; persist: (patch: PlanPatch) => void } {
  const [checks, setChecks] = useState<Record<string, string[]>>(card.planDayChecks ?? {});
  const [titles, setTitles] = useState<Record<string, string>>(card.planDayTitles ?? {});
  useEffect(() => { setChecks(card.planDayChecks ?? {}); }, [card.planDayChecks]);
  useEffect(() => { setTitles(card.planDayTitles ?? {}); }, [card.planDayTitles]);
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const persist = useCallback((patch: PlanPatch) => {
    if (patch.planDayChecks) setChecks(patch.planDayChecks);
    if (patch.planDayTitles) setTitles(patch.planDayTitles);
    chain.current = chain.current.then(() => updateCard(card.id, patch)).catch(() => { });
  }, [card.id]);

  return { card: { ...card, planDayChecks: checks, planDayTitles: titles }, persist };
}
