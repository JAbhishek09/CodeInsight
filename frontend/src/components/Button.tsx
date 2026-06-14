import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
}

const VARIANT_STYLES = {
  primary:
    'bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-95 text-white border border-pink-400/20 shadow-lg shadow-pink-950/20',
  secondary:
    'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700',
  danger:
    'bg-red-950/30 hover:bg-red-950/50 text-red-400 border border-red-500/20 hover:border-red-500/40',
  ghost:
    'bg-transparent hover:bg-slate-900 text-slate-400 hover:text-white border border-transparent',
};

const SIZE_STYLES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-xs rounded-xl',
  lg: 'px-5 py-3 text-sm rounded-xl',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  children,
  disabled,
  className = '',
  ...rest
}) => {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-mono font-bold
        transition-all cursor-pointer active:scale-[0.98]
        disabled:opacity-40 disabled:cursor-not-allowed
        ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}
      `}
      {...rest}
    >
      {loading ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : leftIcon ? (
        <span className="w-3.5 h-3.5 flex items-center justify-center">{leftIcon}</span>
      ) : null}
      {children}
    </button>
  );
};

export default Button;
