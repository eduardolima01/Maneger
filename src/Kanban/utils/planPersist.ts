import { useCallback, useEffect, useRef, useState } from 'react';
import { updateCard, getCardById } from '@/lib/api/kanban/kanbanCards';
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

let toggleChain: Promise<unknown> = Promise.resolve();

/**
 * Marca/desmarca UMA tarefa de UM dia do plano, lendo o estado mais recente do arquivo (não de uma cópia da tela) —
 * serve onde vários quadrados do mesmo plano aparecem ao mesmo tempo (calendário) e uma cópia local ficaria velha.
 * Uma gravação por vez.
 */
export function togglePlanDayTask(cardId: string, date: string, taskId: string): Promise<void> {
  const job = toggleChain.then(async () => {
    const card = await getCardById(cardId);
    if (!card) return;
    const checks = { ...(card.planDayChecks ?? {}) };
    const cur = checks[date] ?? [];
    const next = cur.includes(taskId) ? cur.filter((x) => x !== taskId) : [...cur, taskId];
    if (next.length > 0) checks[date] = next; else delete checks[date];
    await updateCard(cardId, { planDayChecks: checks });
  });
  toggleChain = job.catch(() => { });
  return job;
}

/**
 * Grava a lista de tarefas feitas de UM dia do plano (estado explícito, já decidido pela tela). Lê o card mais recente do
 * arquivo e troca só aquele dia; na mesma fila do togglePlanDayTask pra uma gravação nunca atropelar a outra.
 */
export function setPlanDayChecks(cardId: string, date: string, ids: string[]): Promise<void> {
  const job = toggleChain.then(async () => {
    const card = await getCardById(cardId);
    if (!card) return;
    const checks = { ...(card.planDayChecks ?? {}) };
    if (ids.length > 0) checks[date] = ids; else delete checks[date];
    await updateCard(cardId, { planDayChecks: checks });
  });
  toggleChain = job.catch(() => { });
  return job;
}
