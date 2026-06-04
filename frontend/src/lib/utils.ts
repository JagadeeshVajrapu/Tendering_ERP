import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount?: number): string {
  if (!amount) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(date?: string): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    NIT_ANALYZED: 'bg-blue-100 text-blue-700',
    SUMMARY_GENERATED: 'bg-indigo-100 text-indigo-700',
    PENDING_MD_APPROVAL: 'bg-amber-100 text-amber-700',
    APPROVED_BY_MD: 'bg-emerald-100 text-emerald-700',
    REJECTED_BY_MD: 'bg-red-100 text-red-700',
    FINANCE_PENDING: 'bg-orange-100 text-orange-700',
    FINANCE_APPROVED: 'bg-green-100 text-green-700',
    FINANCE_REJECTED: 'bg-red-100 text-red-700',
    MANAGER_PENDING: 'bg-purple-100 text-purple-700',
    MANAGER_APPROVED: 'bg-teal-100 text-teal-700',
    READY_FOR_BID: 'bg-cyan-100 text-cyan-700',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
}
