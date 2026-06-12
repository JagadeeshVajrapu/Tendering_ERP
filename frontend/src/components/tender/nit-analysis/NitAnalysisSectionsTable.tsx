'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { NitAnalysisFieldRow, NitAnalysisSectionReport } from '@/types/nitAnalysisReport';

interface Props {
  sections: NitAnalysisSectionReport[];
}

function confidenceTone(row: NitAnalysisFieldRow): string {
  const tier = row.confidenceTier;
  if (tier === 'verified') return 'text-emerald-800 bg-emerald-50 border-emerald-200';
  if (tier === 'high') return 'text-blue-800 bg-blue-50 border-blue-200';
  if (tier === 'review') return 'text-amber-800 bg-amber-50 border-amber-200';
  return 'text-slate-600 bg-slate-100 border-slate-200';
}

export function NitAnalysisSectionsTable({ sections }: Props) {
  const displaySections = sections.filter((s) => s.id !== 'risk');

  if (!displaySections.length) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
        No parameters match the current filters. Adjust search or enable low-confidence rows.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {displaySections.map((section) => (
        <Card key={section.id} className="overflow-hidden border-slate-200 shadow-sm print:break-inside-avoid">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                {section.intelligenceLabel && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    {section.intelligenceLabel}
                  </p>
                )}
                <CardTitle className="text-lg text-slate-900">{section.title}</CardTitle>
                <CardDescription className="mt-1">{section.description}</CardDescription>
              </div>
              <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {section.fields.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="min-w-[200px] font-semibold text-slate-700">Parameter</TableHead>
                    <TableHead className="min-w-[240px] font-semibold text-slate-700">Value</TableHead>
                    <TableHead className="w-[80px] font-semibold text-slate-700">Page</TableHead>
                    <TableHead className="w-[150px] font-semibold text-slate-700">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.fields.map((row, index) => (
                    <TableRow key={`${section.id}-${row.key}-${row.sourcePage}-${index}`}>
                      <TableCell className="font-medium text-slate-800">
                        {row.label}
                        {row.parameterType === 'dynamic' && (
                          <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
                            Dynamic
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap text-slate-700">{row.value}</TableCell>
                      <TableCell className="text-slate-500">{row.sourcePage || '—'}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${confidenceTone(row)}`}
                        >
                          {row.confidence != null ? `${row.confidence}%` : row.confidenceLabel || '—'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
