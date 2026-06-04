'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LabelValueExtractionResult } from '@/types/labelValuePair';
import { Search } from 'lucide-react';

export function LabelValuePairsPanel({ data }: { data: LabelValueExtractionResult }) {
  const [query, setQuery] = useState('');
  const [pageFilter, setPageFilter] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const p = pageFilter.trim();
    return data.pairs.filter((pair) => {
      if (p && String(pair.page) !== p) return false;
      if (!q) return true;
      return (
        pair.label.toLowerCase().includes(q) ||
        pair.value.toLowerCase().includes(q)
      );
    });
  }, [data.pairs, query, pageFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Label–Value Pairs</h2>
          <p className="text-sm text-muted-foreground">
            Generic extraction · {data.pagesScanned} pages scanned · no fixed schema
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {data.totalFound} pairs
        </Badge>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search label or value…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          placeholder="Page #"
          value={pageFilter}
          onChange={(e) => setPageFilter(e.target.value.replace(/\D/g, ''))}
          className="w-full sm:w-24"
        />
      </div>

      <Card>
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base font-medium">
            Showing {filtered.length} of {data.totalFound}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b bg-slate-50">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-semibold w-[28%]">Label</th>
                  <th className="px-4 py-2 font-semibold w-[40%]">Value</th>
                  <th className="px-4 py-2 font-semibold w-12">Page</th>
                  <th className="px-4 py-2 font-semibold w-16">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pair, i) => (
                  <tr
                    key={`${pair.page}-${pair.label}-${i}`}
                    className="border-b last:border-0 hover:bg-slate-50/80 align-top"
                  >
                    <td className="px-4 py-2 font-medium text-slate-900">{pair.label}</td>
                    <td className="px-4 py-2 font-mono text-slate-800 break-words">{pair.value}</td>
                    <td className="px-4 py-2 text-muted-foreground tabular-nums">{pair.page}</td>
                    <td className="px-4 py-2 text-muted-foreground tabular-nums">{pair.confidence}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {data.totalFound === 0
                ? 'No label–value pairs detected. Check OCR text quality.'
                : 'No pairs match your search.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
