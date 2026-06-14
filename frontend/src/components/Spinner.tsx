import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const SIZE = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };

export default function Spinner({ size = 'md', label }: SpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={`animate-spin text-pink-500 ${SIZE[size]}`} />
      {label && (
        <p className="text-xs font-mono text-slate-500 uppercase tracking-wider">{label}</p>
      )}
    </div>
  );
}
