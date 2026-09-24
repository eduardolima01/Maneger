import { createContext, useContext } from 'react';
import type { LabelIcon } from '@/types/kanban.types';

export interface LabelIconContextValue {
  /** Ícone de cada etiqueta, pelo NOME da etiqueta (viewPrefs.labelIcons do kanban). */
  icons: Record<string, LabelIcon>;
  /** null = remover o ícone. */
  setIcon: (name: string, icon: LabelIcon | null) => void;
}

const EMPTY: LabelIconContextValue = { icons: {}, setIcon: () => { } };

/**
 * O ícone mora num mapa por nome (não dentro da string da etiqueta em cada card), então trocar o ícone de uma
 * etiqueta muda em todo lugar de uma vez e nenhum `card.labels` precisa ser reescrito. Contexto em vez de props
 * pelo mesmo motivo do CardMoveContext: evita encanar props por Column → GroupBlock → LabelGroupBlock → Card.
 * Fora do KanbanBoard devolve um valor vazio (sem ícones), em vez de quebrar.
 */
export const LabelIconContext = createContext<LabelIconContextValue | null>(null);

export function useLabelIcons(): LabelIconContextValue {
  return useContext(LabelIconContext) ?? EMPTY;
}
