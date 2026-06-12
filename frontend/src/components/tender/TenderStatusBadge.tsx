import {
  getTenderDisplayLabel,
  resolveEffectiveTenderStatus,
  statusColor,
  type TenderDisplayOptions,
} from '@/lib/tenderStatus';
import { cn } from '@/lib/utils';

interface Props extends TenderDisplayOptions {
  status?: string;
  currentStage?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function TenderStatusBadge({
  status,
  currentStage,
  submissionStatus,
  className,
  size = 'md',
}: Props) {
  const options = { submissionStatus };
  const effectiveStatus = resolveEffectiveTenderStatus(status, options) || status || '';
  const label = getTenderDisplayLabel(status, currentStage, options);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-semibold uppercase tracking-wide',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
        statusColor(effectiveStatus),
        className
      )}
    >
      {label}
    </span>
  );
}
