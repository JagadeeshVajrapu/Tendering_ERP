import type { ValidationStatus } from '@/types/documentPreparation';

const STYLES: Record<ValidationStatus | 'unvalidated', string> = {
  valid: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
  unvalidated: 'bg-slate-100 text-slate-500',
};

export function ValidationStatusBadge({
  status,
  score,
}: {
  status?: ValidationStatus | null;
  score?: number;
}) {
  const key = status || 'unvalidated';
  const label = status ? status.toUpperCase() : '—';
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STYLES[key]}`}
    >
      {label}
      {score !== undefined && status ? ` · ${score}` : ''}
    </span>
  );
}
