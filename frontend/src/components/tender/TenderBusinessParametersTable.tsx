'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { NitAnalysisFieldRow } from '@/types/nitAnalysisReport';

interface Props {
  parameters: NitAnalysisFieldRow[];
  title?: string;
  description?: string;
}

function confidenceTone(confidence: number): string {
  if (confidence >= 85) return 'text-emerald-700 bg-emerald-50';
  if (confidence >= 70) return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
}

export function TenderBusinessParametersTable({
  parameters,
  title = 'Tender Parameters',
  description = 'Mapped business fields from the NIT document (Tender Number, EMD, Scope of Work, dates, eligibility, etc.).',
}: Props) {
  if (!parameters.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center text-sm text-muted-foreground">
        No tender parameters extracted yet. Run OCR, then click Re-extract or open NIT Analysis and
        Refresh.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
        <p className="mt-2 text-xs text-slate-500">
          {parameters.length} field{parameters.length === 1 ? '' : 's'} extracted
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="w-12 font-semibold text-slate-700">#</TableHead>
              <TableHead className="min-w-[220px] font-semibold text-slate-700">Parameter</TableHead>
              <TableHead className="min-w-[280px] font-semibold text-slate-700">Value</TableHead>
              <TableHead className="w-[90px] font-semibold text-slate-700">Page</TableHead>
              <TableHead className="w-[110px] font-semibold text-slate-700">Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parameters.map((row, index) => (
              <TableRow key={row.key}>
                <TableCell className="text-slate-500">{index + 1}</TableCell>
                <TableCell className="font-medium text-slate-800">{row.label}</TableCell>
                <TableCell className="whitespace-pre-wrap text-slate-700">{row.value}</TableCell>
                <TableCell className="text-slate-500">{row.sourcePage || '—'}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${confidenceTone(row.confidence)}`}
                  >
                    {row.confidence}%
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
