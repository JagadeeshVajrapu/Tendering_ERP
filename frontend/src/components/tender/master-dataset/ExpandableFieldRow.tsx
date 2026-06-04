'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ConfidenceBadge } from './ConfidenceBadge';
import { formatExtractionMethod, LOW_CONFIDENCE_THRESHOLD } from '@/lib/masterDatasetSections';
import type { DatasetRowView } from '@/types/masterDataset';
import { cn } from '@/lib/utils';

interface Props {
  row: DatasetRowView;
  forceExpanded?: boolean;
}

export function ExpandableFieldRow({ row, forceExpanded }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpanded ?? expanded;
  const hasValue = !!row.field.value.trim();
  const lowConfidence = hasValue && row.field.confidence < LOW_CONFIDENCE_THRESHOLD;

  return (
    <>
      <TableRow
        className={cn(
          'cursor-pointer transition-colors hover:bg-slate-50/80',
          lowConfidence && 'bg-amber-50/60 hover:bg-amber-50',
          isExpanded && 'bg-slate-50'
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        <TableCell className="w-10 py-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </TableCell>
        <TableCell className="py-3 font-medium text-slate-800">{row.parameter}</TableCell>
        <TableCell className="max-w-md py-3 text-slate-700">
          <span className={cn('line-clamp-2', !hasValue && 'text-slate-400 italic')}>
            {hasValue ? row.field.value : 'Not extracted'}
          </span>
        </TableCell>
        <TableCell className="py-3">
          <ConfidenceBadge confidence={row.field.confidence} hasValue={hasValue} />
        </TableCell>
        <TableCell className="py-3 text-sm tabular-nums text-slate-600">
          {row.field.sourcePage ? `p. ${row.field.sourcePage}` : '—'}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className={cn('border-t-0', lowConfidence && 'bg-amber-50/40')}>
          <TableCell colSpan={5} className="bg-slate-50/80 px-6 py-4">
            <div className="grid gap-4 md:grid-cols-3">
              <DetailBlock title="Source Text" className="md:col-span-2">
                <p className="whitespace-pre-wrap rounded-lg border bg-white p-3 text-sm leading-relaxed text-slate-700">
                  {row.field.sourceText?.trim() || 'No source text captured for this field.'}
                </p>
              </DetailBlock>
              <div className="space-y-4">
                <DetailBlock title="Validation Result">
                  <StatusPill
                    tone={
                      row.field.validationResult.startsWith('Valid')
                        ? 'success'
                        : row.field.validationResult.startsWith('Invalid')
                          ? 'danger'
                          : 'neutral'
                    }
                    text={row.field.validationResult}
                  />
                </DetailBlock>
                <DetailBlock title="Extraction Method">
                  <StatusPill tone="info" text={formatExtractionMethod(row.field.extractionMethod)} />
                </DetailBlock>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function DetailBlock({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {children}
    </div>
  );
}

function StatusPill({
  text,
  tone,
}: {
  text: string;
  tone: 'success' | 'danger' | 'neutral' | 'info';
}) {
  const tones = {
    success: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    danger: 'bg-red-50 text-red-800 ring-red-100',
    neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
    info: 'bg-blue-50 text-blue-800 ring-blue-100',
  };
  return (
    <span className={cn('inline-flex rounded-lg px-3 py-2 text-sm font-medium ring-1', tones[tone])}>
      {text}
    </span>
  );
}
