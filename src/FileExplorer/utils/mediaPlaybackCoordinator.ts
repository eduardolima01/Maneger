let activeElement: HTMLMediaElement | null = null;

/**
 * Garante que só um áudio/vídeo toca por vez no Explorador: ao começar a
 * tocar um, pausa o anterior (se for outro elemento). Estado module-level
 * de propósito — é só "pausar o elemento DOM anterior", não precisa de
 * contexto React nem de lift state pra cima da árvore de componentes.
 */
export function registerPlayback(el: HTMLMediaElement): void {
  if (activeElement && activeElement !== el) {
    activeElement.pause();
  }
  activeElement = el;
}

export function unregisterPlayback(el: HTMLMediaElement): void {
  if (activeElement === el) activeElement = null;
}
