'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps {
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  'aria-label'?: string;
}

export function Checkbox({
  checked = false,
  disabled = false,
  onCheckedChange,
  className,
  'aria-label': ariaLabel,
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300 bg-white transition-colors',
        checked && 'border-blue-600 bg-blue-600 text-white',
        disabled && 'cursor-not-allowed opacity-50',
        !disabled && 'hover:border-blue-500',
        className
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
}
