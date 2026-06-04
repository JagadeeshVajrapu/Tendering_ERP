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
import type { NitAnalysisSectionReport } from '@/types/nitAnalysisReport';

interface Props {
  sections: NitAnalysisSectionReport[];
}

function confidenceTone(confidence: number): string {
  if (confidence >= 85) return 'text-emerald-700 bg-emerald-50';
  if (confidence >= 70) return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
}

export function NitAnalysisSectionsTable({ sections }: Props) {
  if (!sections.length) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
        No business fields were mapped yet. Check discovered parameters below or re-run extraction.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <Card key={section.id} className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg text-slate-900">{section.title}</CardTitle>
                <CardDescription className="mt-1">{section.description}</CardDescription>
              </div>
              <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {section.fields.length} field{section.fields.length === 1 ? '' : 's'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="min-w-[200px] font-semibold text-slate-700">Field</TableHead>
                    <TableHead className="min-w-[240px] font-semibold text-slate-700">Value</TableHead>
                    <TableHead className="w-[100px] font-semibold text-slate-700">Page</TableHead>
                    <TableHead className="w-[110px] font-semibold text-slate-700">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.fields.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium text-slate-800">{row.label}</TableCell>
                      <TableCell className="text-slate-700">{row.value}</TableCell>
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
