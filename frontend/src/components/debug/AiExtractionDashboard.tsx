'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AiExtractionDebugResult } from '@/types/aiExtractionDebug';
import { ArrowRight, Search } from 'lucide-react';

function pct(n: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

export function AiExtractionDashboard({ data }: { data: AiExtractionDebugResult }) {
  const [query, setQuery] = useState('');
  const { comparison: c } = data;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.parameters;
    return data.parameters.filter(
      (row) =>
        row.parameter.toLowerCase().includes(q) ||
        row.value.toLowerCase().includes(q) ||
        row.sourceText.toLowerCase().includes(q) ||
        row.sourceSection.toLowerCase().includes(q) ||
        (row.originalLabel?.toLowerCase().includes(q) ?? false)
    );
  }, [data.parameters, query]);

  return (
    <div className="space-y-6">
      <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-white">
        <CardContent className="flex flex-col gap-2 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-violet-700">AI Extraction (pre-validation snapshot)</p>
            <p className="text-3xl font-bold tracking-tight">
              AI Extracted Parameters: {data.totalExtractedParameters}
            </p>
            {data.originalName && (
              <p className="mt-1 text-sm text-muted-foreground">{data.originalName}</p>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            <div>Model: {data.aiModel || '—'}</div>
            <div>Pages scanned: {data.pagesScanned}</div>
            {data.extractedAt && (
              <div>Extracted: {new Date(data.extractedAt).toLocaleString()}</div>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          AI Extraction vs Validation Output
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">AI Extracted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-700">{c.aiExtractedCount}</div>
              <p className="text-xs text-muted-foreground">Immutable pre-validation snapshot</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Validated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700">{c.validatedCount}</div>
              <p className="text-xs text-muted-foreground">
                {pct(c.validatedCount, c.aiExtractedCount)} of AI extracted
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">{c.rejectedCount}</div>
              <p className="text-xs text-muted-foreground">
                Lost in validation: {c.lostInValidation}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Master Dataset</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{c.masterDatasetCount}</div>
              <p className="text-xs text-muted-foreground">
                Rank winners: {c.rankWinnerCount} · Losers: {c.rankLoserCount}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Filter by parameter, value, source text, or section…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Badge variant="outline">{filtered.length} shown</Badge>
        <Link
          href={`/debug/parameter-candidates?documentId=${data.documentId}`}
          className="inline-flex items-center gap-1 text-sm text-violet-700 hover:underline"
        >
          View post-validation candidates
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b bg-slate-50">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Parameter</th>
                <th className="px-4 py-2 font-semibold">Value</th>
                <th className="px-4 py-2 font-semibold w-14">Page</th>
                <th className="px-4 py-2 font-semibold w-20">Confidence</th>
                <th className="px-4 py-2 font-semibold min-w-[200px]">Source Text</th>
                <th className="px-4 py-2 font-semibold">Source Section</th>
                <th className="px-4 py-2 font-semibold min-w-[120px]">Document ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={`${row.page}-${row.parameter}-${i}`} className="border-b last:border-0 hover:bg-slate-50/80">
                  <td className="px-4 py-2 align-top font-medium">{row.parameter}</td>
                  <td className="px-4 py-2 align-top max-w-xs break-words">{row.value}</td>
                  <td className="px-4 py-2 align-top">{row.page}</td>
                  <td className="px-4 py-2 align-top">
                    <Badge variant="secondary">{Math.round(row.confidence * 100)}%</Badge>
                  </td>
                  <td className="px-4 py-2 align-top max-w-md text-xs text-muted-foreground break-words">
                    {row.sourceText}
                  </td>
                  <td className="px-4 py-2 align-top">
                    <Badge variant="outline">{row.sourceSection}</Badge>
                  </td>
                  <td className="px-4 py-2 align-top font-mono text-xs text-muted-foreground break-all">
                    {row.documentId}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No parameters match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
