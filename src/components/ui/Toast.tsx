import { useEffect } from 'react';

interface ToastProps {
  message: string;
  variant?: 'error' | 'info';
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ message, variant = 'info', onDismiss, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div
      style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        backgroundColor: variant === 'error' ? '#c62828' : '#333', color: '#fff',
        padding: '10px 16px', borderRadius: 6, fontSize: 13, boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        zIndex: 2000,
      }}
    >
      {message}
    </div>
  );
}
