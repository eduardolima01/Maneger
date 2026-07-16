import { useState, useRef, type ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'right' | 'top' | 'bottom' | 'left';
  disabled?: boolean;
}

const SIDE_CLASSES: Record<NonNullable<TooltipProps['side']>, string> = {
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
};

export default function Tooltip({ content, children, side = 'right', disabled = false }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => setVisible(true), 300);
  }

  function hide() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  }

  return (
    <div onMouseEnter={show} onMouseLeave={hide} className="relative inline-flex">
      {children}
      {!disabled && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-md transition-opacity duration-150 dark:bg-zinc-700 ${SIDE_CLASSES[side]} ${visible ? 'opacity-100' : 'opacity-0'}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
