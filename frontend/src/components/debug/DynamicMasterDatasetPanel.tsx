'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DynamicMasterDatasetResult } from '@/types/dynamicMasterDataset';
import { Search } from 'lucide-react';

const CATEGORIES = [
  'Identity',
  'Financial',
  'Timeline',
  'Eligibility',
  'Compliance',
  'Experience',
  'Scope',
  'Tender Specific',
  'Additional Tender Parameters',
];

export function DynamicMasterDatasetPanel({ data }: { data: DynamicMasterDatasetResult }) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.parameters.filter((row) => {
      if (categoryFilter && row.category !== categoryFilter) return false;
      if (typeFilter && row.parameterType !== typeFilter) return false;
      if (!q) return true;
      return (
        row.parameter.toLowerCase().includes(q) ||
        row.value.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q)
      );
    });
  }, [data.parameters, query, categoryFilter, typeFilter]);

  const byCategory = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const cat of CATEGORIES) map.set(cat, []);
    for (const row of filtered) {
      const cat = CATEGORIES.includes(row.category) ? row.category : 'Additional Tender Parameters';
      map.get(cat)!.push(row);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{data.statistics.totalParameters}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Core</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-700">{data.statistics.coreCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Dynamic</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-violet-700">{data.statistics.dynamicCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Review</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-amber-700">{data.statistics.reviewCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Version</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">v{data.currentVersion}</CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search parameters…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border bg-white px-3 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-white px-3 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Core + Dynamic</option>
          <option value="core">Core only</option>
          <option value="dynamic">Dynamic only</option>
        </select>
      </div>

      {CATEGORIES.map((category) => {
        const rows = byCategory.get(category) || [];
        if (!rows.length) return null;
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {category}
                <Badge variant="outline">{rows.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-semibold">Parameter</th>
                    <th className="px-4 py-2 font-semibold">Value</th>
                    <th className="px-4 py-2 font-semibold">Page</th>
                    <th className="px-4 py-2 font-semibold">Confidence</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={`${category}-${row.parameter}-${idx}`} className="border-b align-top last:border-0">
                      <td className="px-4 py-2 font-medium">
                        {row.parameter}
                        {row.parameterType === 'dynamic' && (
                          <Badge variant="outline" className="ml-2 text-xs">Dynamic</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 max-w-md break-words">{row.value}</td>
                      <td className="px-4 py-2">{row.page}</td>
                      <td className="px-4 py-2">{row.confidence}%</td>
                      <td className="px-4 py-2 text-xs">{row.validationStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
