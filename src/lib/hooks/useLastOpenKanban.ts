export function getLastOpenKanban(projectId: string): string | null {
  try {
    return localStorage.getItem(`maneger:lastKanban:${projectId}`);
  } catch {
    return null;
  }
}

export function setLastOpenKanban(projectId: string, kanbanId: string): void {
  try {
    localStorage.setItem(`maneger:lastKanban:${projectId}`, kanbanId);
  } catch {
    // indisponível — preferência não persiste, sem impacto funcional
  }
}
