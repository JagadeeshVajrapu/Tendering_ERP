'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EnterpriseDynamicParameterExtractionResult } from '@/types/enterpriseDynamicParameterExtraction';
import { Search } from 'lucide-react';

export function EnterpriseDynamicParameterExtractionPanel({
  data,
}: {
  data: EnterpriseDynamicParameterExtractionResult;
}) {
  const [query, setQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.parameters.filter((row) => {
      if (sectionFilter && row.sectionName !== sectionFilter && row.category !== sectionFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.parameter.toLowerCase().includes(q) ||
        row.value.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q)
      );
    });
  }, [data.parameters, query, sectionFilter]);

  const sections = Array.from(
    new Set(data.sectionResults.map((s) => s.sectionName).filter(Boolean))
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Parameters</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data.totalParameters}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Known</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-700">{data.knownParameterCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unknown / Dynamic</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-violet-700">{data.unknownParameterCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tender Type</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{data.tenderType || '—'}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sections</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data.sectionsProcessed}</CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Filter by parameter, value, or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border bg-white px-3 text-sm"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
        >
          <option value="">All sections</option>
          {sections.map((section) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Extracted Parameters ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b bg-slate-50">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Parameter</th>
                <th className="px-4 py-2 font-semibold">Value</th>
                <th className="px-4 py-2 font-semibold w-12">Page</th>
                <th className="px-4 py-2 font-semibold w-16">Conf.</th>
                <th className="px-4 py-2 font-semibold">Category</th>
                <th className="px-4 py-2 font-semibold">Source Text</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr key={`${row.page}-${row.parameter}-${idx}`} className="border-b align-top last:border-0">
                  <td className="px-4 py-2 font-medium">
                    {row.parameter}
                    {row.isCoreParameter === false && (
                      <Badge variant="outline" className="ml-2 text-xs">Dynamic</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 max-w-xs break-words">{row.value}</td>
                  <td className="px-4 py-2">{row.page}</td>
                  <td className="px-4 py-2">{row.confidence}%</td>
                  <td className="px-4 py-2">{row.category}</td>
                  <td className="px-4 py-2 max-w-md text-xs text-muted-foreground break-words">{row.sourceText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
