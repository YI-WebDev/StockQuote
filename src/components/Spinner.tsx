import { Loader2 } from 'lucide-react';

export default function Spinner({ className = '', label }: { className?: string; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Loader2 className={`w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400 ${className}`} />
      {label && (
        <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">{label}</p>
      )}
    </div>
  );
}
