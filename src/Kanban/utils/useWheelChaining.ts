import { useEffect, type RefObject } from 'react';

/** Procura o ancestral rolável mais próximo que ainda pode rolar naquela direção (-1 = pra cima, 1 = pra baixo). */
function findScrollTarget(start: HTMLElement | null, dir: -1 | 1): HTMLElement | null {
  let n: HTMLElement | null = start;
  while (n && n !== document.body && n !== document.documentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) {
      const canUp = n.scrollTop > 0;
      const canDown = n.scrollTop + n.clientHeight < n.scrollHeight - 1;
      if (dir < 0 ? canUp : canDown) return n;
    }
    n = n.parentElement;
  }
  const root = document.scrollingElement as HTMLElement | null;
  if (!root) return null;
  const canUp = root.scrollTop > 0;
  const canDown = root.scrollTop + root.clientHeight < root.scrollHeight - 1;
  return (dir < 0 ? canUp : canDown) ? root : null;
}

/**
 * Evita a rolagem "grudenta" de áreas com rolagem aninhadas (grupo dentro de grupo dentro de coluna, etc.): quando a
 * roda chega no fim (ou no começo) da área, a rolagem passa NA HORA pro ancestral que ainda pode rolar — sem esperar
 * o gesto da roda terminar, que é o que prendia o ponteiro dentro da área interna. Ctrl+roda (zoom) e rolagem
 * horizontal seguem o comportamento normal.
 */
export function useWheelChaining<T extends HTMLElement>(ref: RefObject<T>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!el || e.ctrlKey || e.defaultPrevented || e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (el.scrollHeight <= el.clientHeight + 1) return; // esta área nem rola: o navegador já passa pro pai
      const dir: -1 | 1 = e.deltaY < 0 ? -1 : 1;
      const atEdge = dir < 0 ? el.scrollTop <= 0 : el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if (!atEdge) return; // ainda tem pra rolar aqui dentro: comportamento normal
      const target = findScrollTarget(el.parentElement, dir);
      if (!target) return;
      e.preventDefault();
      target.scrollBy({ top: e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY });
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref]);
}
