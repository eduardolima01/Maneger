/**
 * "Área de transferência" da checklist: copiar a lista de um card e colar em outro (inclusive de OUTRO kanban).
 * O texto fica guardado no localStorage do app — sempre funciona, sem depender de permissão do webview — e, por
 * conveniência, também vai pra área de transferência do sistema (pra colar fora do app, ex. num bloco de notas).
 * Formato: o mesmo do "Modo texto" da checklist (`- [ ] item`, `- [~]`, `- [x]`, `- [lista]`), então o que foi
 * copiado volta com os estados e as listas simples.
 */
const CLIPBOARD_KEY = 'kanban-checklist-clipboard';

export async function writeChecklistClipboard(text: string): Promise<void> {
  try { localStorage.setItem(CLIPBOARD_KEY, text); } catch { /* sem storage: ainda tenta o clipboard do sistema */ }
  try { await navigator.clipboard?.writeText(text); } catch { /* o do sistema é só bônus */ }
}

/** Última lista copiada no app; se não houver, tenta o texto da área de transferência do sistema. null = nada pra colar. */
export async function readChecklistClipboard(): Promise<string | null> {
  try {
    const stored = localStorage.getItem(CLIPBOARD_KEY);
    if (stored && stored.trim()) return stored;
  } catch { /* cai pro clipboard do sistema */ }
  try {
    const system = await navigator.clipboard?.readText();
    if (system && system.trim()) return system;
  } catch { /* sem permissão: sem nada pra colar */ }
  return null;
}
