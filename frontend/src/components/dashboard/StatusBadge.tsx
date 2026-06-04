import { cn } from '@/lib/utils';

const styles: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  FINANCE_PENDING: 'bg-amber-100 text-amber-800',
  FINANCE_APPROVED: 'bg-green-100 text-green-800',
  FINANCE_REJECTED: 'bg-red-100 text-red-800',
  MANAGER_PENDING: 'bg-purple-100 text-purple-800',
  MANAGER_APPROVED: 'bg-green-100 text-green-800',
  PAID: 'bg-blue-100 text-blue-800',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const display = label || status.replace(/_/g, ' ');
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', styles[status] || 'bg-slate-100 text-slate-700')}>
      {display}
    </span>
  );
}
