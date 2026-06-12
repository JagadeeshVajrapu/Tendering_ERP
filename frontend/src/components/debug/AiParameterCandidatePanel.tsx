'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TenderParameterCandidateExtractionResult } from '@/types/tenderParameterCandidate';
import { Search } from 'lucide-react';

export function AiParameterCandidatePanel({ data }: { data: TenderParameterCandidateExtractionResult }) {
  const [query, setQuery] = useState('');
  const aliasCount = data.candidates.filter((c) => c.aliasMapped).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.candidates;
    return data.candidates.filter(
      (c) =>
        c.parameter.toLowerCase().includes(q) ||
        c.originalLabel.toLowerCase().includes(q) ||
        c.value.toLowerCase().includes(q)
    );
  }, [data.candidates, query]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Candidates</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data.totalCandidates}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alias Mapped</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-indigo-700">{aliasCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pages Scanned</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data.pagesScanned}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ranked Winners</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-violet-700">
            {data.rankingStats?.winnerCount ?? data.totalCandidates}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">AI Model</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-semibold">{data.aiModel || '—'}</CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Filter by parameter, original label, or value…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b bg-slate-50">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Parameter (Canonical)</th>
                <th className="px-4 py-2 font-semibold">Original Label</th>
                <th className="px-4 py-2 font-semibold">Value</th>
                <th className="px-4 py-2 font-semibold w-12">Page</th>
                <th className="px-4 py-2 font-semibold w-14">Conf.</th>
                <th className="px-4 py-2 font-semibold w-14">Rank</th>
                <th className="px-4 py-2 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={`${c.page}-${c.parameter}-${i}`} className="border-b last:border-0 hover:bg-slate-50/80 align-top">
                  <td className="px-4 py-2 font-medium">
                    {c.parameter}
                    {c.aliasMapped && (
                      <Badge variant="outline" className="ml-2 text-[10px] text-indigo-700">
                        mapped
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{c.originalLabel}</td>
                  <td className="px-4 py-2 font-mono break-words">{c.value}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.page}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.confidence}%</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.rankScore ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs truncate" title={c.sourceText}>
                    {c.sourceText}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="p-8 text-center text-sm text-muted-foreground">No candidates match your filter.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
