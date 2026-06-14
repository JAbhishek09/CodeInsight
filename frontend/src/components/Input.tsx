import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, leftIcon, className = '', ...rest }) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
            {leftIcon}
          </span>
        )}
        <input
          className={`
            w-full bg-[#05070a] border rounded-xl text-xs text-slate-200 placeholder-slate-600
            focus:outline-none focus:ring-1 font-mono transition-all
            ${error
              ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20'
              : 'border-slate-900 focus:border-pink-500/60 focus:ring-pink-500/20'
            }
            ${leftIcon ? 'pl-11' : 'px-4'} py-2.5
            ${className}
          `}
          {...rest}
        />
      </div>
      {error && (
        <p className="text-[10px] font-mono text-red-400">{error}</p>
      )}
    </div>
  );
};

export default Input;
