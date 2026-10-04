import { useSyncExternalStore } from 'react';

/**
 * Seleção de evento compartilhada pela Agenda (um evento por vez).
 * Clique num card seleciona; Esc ou clique fora desmarca. Os atalhos de teclado
 * (W/S etc.) agem no selecionado, mesmo com o mouse longe dele.
 */
let selectedId: string | null = null;
const listeners = new Set<() => void>();
// cards atualmente na tela, por id de evento (um evento pode ter 2 blocos: início e continuação)
const mounted = new Map<string, number>();

function emit() {
  listeners.forEach((l) => l());
}

export function getSelectedEventId(): string | null {
  return selectedId;
}

export function selectEvent(id: string | null) {
  if (id === selectedId) return;
  selectedId = id;
  emit();
}

export function useSelectedEventId(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSelectedEventId,
  );
}

/** Cada card chama isto ao montar; devolve o cleanup. */
export function registerEventBlock(id: string): () => void {
  mounted.set(id, (mounted.get(id) ?? 0) + 1);
  return () => {
    const n = (mounted.get(id) ?? 1) - 1;
    if (n <= 0) mounted.delete(id);
    else mounted.set(id, n);
  };
}

/** Alvo dos atalhos: o selecionado, se estiver na tela; senão null (vale o card sob o mouse). */
export function getActiveSelectedId(): string | null {
  return selectedId !== null && mounted.has(selectedId) ? selectedId : null;
}

type Direction = 'up' | 'down' | 'left' | 'right';

/** Retângulo do card realmente visível (recortado pelos contêineres com rolagem/overflow e pela janela); null se escondido. */
function visibleRect(el: HTMLElement): DOMRect | null {
  const r = el.getBoundingClientRect();
  let left = Math.max(r.left, 0);
  let top = Math.max(r.top, 0);
  let right = Math.min(r.right, window.innerWidth);
  let bottom = Math.min(r.bottom, window.innerHeight);
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    const cs = getComputedStyle(parent);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const pr = parent.getBoundingClientRect();
      left = Math.max(left, pr.left);
      top = Math.max(top, pr.top);
      right = Math.min(right, pr.right);
      bottom = Math.min(bottom, pr.bottom);
    }
    parent = parent.parentElement;
  }
  if (right - left < 4 || bottom - top < 4) return null;
  return new DOMRect(left, top, right - left, bottom - top);
}

/**
 * Navegação espacial entre os cards visíveis (W/A/S/D): acima, à esquerda, abaixo, à direita.
 * Sem seleção, escolhe o card sob o mouse ou, na falta dele, o primeiro visível.
 */
function navigate(dir: Direction) {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>('[data-event-block]'))
    .map((el) => ({ el, id: el.dataset.eventId ?? '', rect: visibleRect(el) }))
    .filter((b): b is { el: HTMLElement; id: string; rect: DOMRect } => !!b.rect && !!b.id);
  if (blocks.length === 0) return;

  const choose = (b: { el: HTMLElement; id: string }) => {
    selectEvent(b.id);
    b.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const currentId = getActiveSelectedId();
  const currentBlocks = currentId ? blocks.filter((b) => b.id === currentId) : [];
  if (currentBlocks.length === 0) {
    const hovered = document.querySelector<HTMLElement>('[data-event-block]:hover');
    const first = [...blocks].sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)[0];
    choose(blocks.find((b) => b.el === hovered) ?? first);
    return;
  }

  // evento com 2 blocos (cruza a meia-noite): usa o do início como referência
  const cur = currentBlocks.find((b) => b.el.dataset.segment === 'start') ?? currentBlocks[0];
  const cr = cur.rect;
  let best: (typeof blocks)[number] | null = null;
  let bestScore = Infinity;
  for (const b of blocks) {
    if (b.id === currentId) continue;
    const r = b.rect;
    const dxCenter = Math.abs(r.left + r.width / 2 - (cr.left + cr.width / 2));
    let score: number;
    if (dir === 'up') {
      if (r.top >= cr.top - 1) continue;
      score = cr.top - r.top + 4 * dxCenter; // prefere ficar na mesma coluna (mesmo dia)
    } else if (dir === 'down') {
      if (r.top <= cr.top + 1) continue;
      score = r.top - cr.top + 4 * dxCenter;
    } else if (dir === 'left') {
      if (r.right > cr.left + 4) continue; // só colunas à esquerda (lanes do mesmo dia se sobrepõem)
      score = cr.left - r.right + 0.3 * Math.abs(r.top - cr.top);
    } else {
      if (r.left < cr.right - 4) continue;
      score = r.left - cr.right + 0.3 * Math.abs(r.top - cr.top);
    }
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  if (best) choose(best);
}

const NAV_KEYS: Record<string, Direction> = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
    const dir = NAV_KEYS[e.code];
    if (!dir) return;
    const el = e.target as HTMLElement | null;
    const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    if (typing) return;
    e.preventDefault();
    navigate(dir);
  });

  // clique fora de qualquer card desmarca (fase de captura: roda antes do card selecionar a si mesmo)
  window.addEventListener(
    'pointerdown',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.('[data-event-block]')) selectEvent(null);
    },
    true,
  );
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const el = e.target as HTMLElement | null;
    const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    if (!typing) selectEvent(null);
  });
}
