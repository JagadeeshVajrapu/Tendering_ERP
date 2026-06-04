import { cn } from '@/lib/utils';
import { LOW_CONFIDENCE_THRESHOLD } from '@/lib/masterDatasetSections';

interface Props {
  confidence: number;
  hasValue?: boolean;
  className?: string;
}

export function ConfidenceBadge({ confidence, hasValue = true, className }: Props) {
  if (!hasValue) {
    return (
      <span className={cn('inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500', className)}>
        —
      </span>
    );
  }

  const low = confidence < LOW_CONFIDENCE_THRESHOLD;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums',
        low ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
        className
      )}
    >
      {confidence}%
      {low && <span className="ml-1 text-[10px] uppercase tracking-wide">Review</span>}
    </span>
  );
}
