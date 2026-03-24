import { Loader2 } from 'lucide-react';

export default function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400 ${className}`} />;
}
