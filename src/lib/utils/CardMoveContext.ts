import { createContext, useContext } from 'react';
import type { KanbanColumn, KanbanCardGroup } from '@/types/kanban.types';

/** Destino de um "Mover para…": uma coluna (card solto) ou um grupo/subgrupo (card dentro dele). */
export type CardMoveTarget =
  | { kind: 'column'; columnId: string }
  | { kind: 'group'; groupId: string };

export interface CardMoveContextValue {
  /** Só colunas visíveis (mover pra coluna arquivada faria o card sumir do quadro). */
  columns: KanbanColumn[];
  /** Todos os grupos E subgrupos do kanban (subgrupo se reconhece por `parentGroupId`). */
  groups: KanbanCardGroup[];
  moveCards: (cardIds: string[], target: CardMoveTarget) => Promise<void>;
}

/**
 * Fica `null` fora do KanbanBoard — quem consome (KanbanCard) trata isso desabilitando o item
 * de menu, em vez de quebrar. Contexto em vez de props porque isso evita encanar 4 props novas
 * por KanbanColumn → GroupBlock → LabelGroupBlock → KanbanCard.
 */
export const CardMoveContext = createContext<CardMoveContextValue | null>(null);

export function useCardMove(): CardMoveContextValue | null {
  return useContext(CardMoveContext);
}
