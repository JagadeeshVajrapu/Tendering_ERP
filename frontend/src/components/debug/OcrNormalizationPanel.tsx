'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { OcrNormalizationResponse } from '@/types/ocrNormalization';

interface Props {
  data: OcrNormalizationResponse;
}

export function OcrNormalizationPanel({ data }: Props) {
  return (
    <div className="space-y-4">
      <Card className="border-teal-200 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-teal-50/80 to-white pb-4">
          <CardTitle className="text-lg text-slate-900">OCR Normalization Summary</CardTitle>
          <CardDescription>
            {data.originalName && <span className="block">{data.originalName}</span>}
            {data.totalRecords} records from {data.pagesScanned} pages · Document{' '}
            <code className="text-xs">{data.documentId}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2">
            {data.pageSummaries.map((p) => (
              <span
                key={p.page}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                Page {p.page}: {p.recordCount} labels ({p.characterCount.toLocaleString()} chars)
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b bg-slate-50/80 pb-3">
          <CardTitle className="text-base">Normalized records</CardTitle>
          <CardDescription>Label | Value | Page — verify before running extraction</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!data.records.length ? (
            <p className="p-8 text-center text-sm text-amber-800">
              No label–value pairs found. OCR text may be one block without lines like{' '}
              <strong>EMD:</strong> or <strong>Name of Work:</strong>. Check{' '}
              <a href={`/debug/pages?documentId=${data.documentId}`} className="underline">
                OCR pages
              </a>{' '}
              first.
            </p>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-50">
                  <TableRow>
                    <TableHead className="w-12 font-semibold">#</TableHead>
                    <TableHead className="min-w-[200px] font-semibold">Label</TableHead>
                    <TableHead className="min-w-[320px] font-semibold">Value</TableHead>
                    <TableHead className="w-[80px] font-semibold">Page</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.records.map((row, i) => (
                    <TableRow key={`${row.page}-${row.label}-${i}`}>
                      <TableCell className="text-slate-500">{i + 1}</TableCell>
                      <TableCell className="font-medium text-slate-800">{row.label}</TableCell>
                      <TableCell className="whitespace-pre-wrap text-slate-700">{row.value}</TableCell>
                      <TableCell>{row.page}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
