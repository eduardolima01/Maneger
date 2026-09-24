import { createContext, useContext } from 'react';

export interface GroupLayoutContextValue {
  /** Ids de grupo/subgrupo (qualquer profundidade) que estão em modo horizontal agora. */
  horizontalIds: Set<string>;
  toggleHorizontal: (groupId: string) => void;
}

const EMPTY: GroupLayoutContextValue = { horizontalIds: new Set(), toggleHorizontal: () => { } };

/**
 * Guarda quais grupos/subgrupos estão em modo horizontal (viewPrefs.horizontalGroupIds do kanban), por id —
 * cada bloco decide sozinho, independente da profundidade dele ou do estado do pai. Contexto em vez de props
 * pelo mesmo motivo do CardMoveContext/LabelIconContext: evita encanar por Column → GroupBlock (recursivo) →
 * LabelGroupBlock, e evita repetir o bug de "collapsed sempre false" que os subgrupos têm hoje nesse caminho.
 * Fora do KanbanBoard devolve um valor vazio (tudo vertical), em vez de quebrar.
 */
export const GroupLayoutContext = createContext<GroupLayoutContextValue | null>(null);

export function useGroupLayout(): GroupLayoutContextValue {
  return useContext(GroupLayoutContext) ?? EMPTY;
}
