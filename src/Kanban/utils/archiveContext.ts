import { createContext, useContext } from 'react';

/** Arquivar/desarquivar card e grupo sem passar props por todos os componentes (quadro, colunas, grupos, árvore). */
export interface ArchiveActions {
  archiveCard: (cardId: string, archived: boolean) => void;
  archiveGroup: (groupId: string, archived: boolean) => void;
  isGroupArchived: (groupId: string) => boolean;
}

export const ArchiveContext = createContext<ArchiveActions | null>(null);

export function useArchive(): ArchiveActions | null {
  return useContext(ArchiveContext);
}
