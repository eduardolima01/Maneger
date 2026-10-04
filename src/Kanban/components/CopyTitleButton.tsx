import { useEffect, useRef, useState } from 'react';

/** Copia pro clipboard; cai num fallback com textarea se a Clipboard API não estiver disponível no webview. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* tenta o fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Ícone "copiar" em SVG (usa currentColor, então segue as classes de cor/tema). */
function CopyIcon({ size }: { size: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

interface CopyTitleButtonProps {
  text: string;
  size?: number;
}

/**
 * Botão "copiar título". Fica invisível e só aparece quando o mouse está sobre o elemento pai marcado com
 * `className="group/title"` (o título + este botão). Depois de copiar, mostra ✓ por um instante.
 * Não deixa o clique/arrasto "vazar" pro card (abrir modal, iniciar drag).
 */
export default function CopyTitleButton({ text, size = 11 }: CopyTitleButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const ok = await copyText(text);
    setState(ok ? 'copied' : 'error');
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setState('idle'), 1200);
  }

  const visibility = state !== 'idle'
    ? 'opacity-100'
    : 'opacity-0 group-hover/title:opacity-100 focus-visible:opacity-100';
  const color = state === 'copied'
    ? 'text-green-600 dark:text-green-400'
    : state === 'error'
      ? 'text-red-600 dark:text-red-400'
      : 'text-neutral-400 dark:text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400';

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      title={state === 'copied' ? 'Copiado!' : state === 'error' ? 'Não foi possível copiar' : 'Copiar título'}
      aria-label="Copiar título"
      className={`bg-transparent border-0 p-0 cursor-pointer shrink-0 leading-none ${visibility} ${color}`}
      style={{ fontSize: size }}
    >
      {state === 'copied' ? '✓' : state === 'error' ? '✕' : <CopyIcon size={size} />}
    </button>
  );
}
