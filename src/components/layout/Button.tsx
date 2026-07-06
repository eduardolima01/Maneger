import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: { backgroundColor: '#2563eb', color: '#fff' },
  secondary: { backgroundColor: '#e5e7eb', color: '#111827' },
  danger: { backgroundColor: '#dc2626', color: '#fff' },
};

export default function Button({
  children,
  variant = 'primary',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      style={{
        padding: '8px 16px',
        border: 'none',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontWeight: 500,
        ...variantStyles[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
