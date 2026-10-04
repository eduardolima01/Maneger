import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white',
  secondary: 'bg-gray-200 text-gray-900 dark:bg-neutral-700 dark:text-neutral-100',
  danger: 'bg-red-600 text-white',
};

export default function Button({
  children,
  variant = 'primary',
  disabled,
  style,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={[variantClasses[variant], className].filter(Boolean).join(' ')}
      style={{
        padding: '8px 16px',
        border: 'none',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontWeight: 500,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
