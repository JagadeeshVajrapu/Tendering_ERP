'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EnterpriseAliasValidationResult } from '@/types/enterpriseAliasValidation';
import { Search } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  VALID: 'bg-emerald-100 text-emerald-800',
  VALID_DYNAMIC_PARAMETER: 'bg-violet-100 text-violet-800',
  REVIEW: 'bg-amber-100 text-amber-800',
  REJECT: 'bg-red-100 text-red-800',
};

export function EnterpriseAliasValidationPanel({ data }: { data: EnterpriseAliasValidationResult }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.parameters.filter((row) => {
      if (statusFilter && row.validationStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        row.parameter.toLowerCase().includes(q) ||
        row.originalLabel.toLowerCase().includes(q) ||
        row.value.toLowerCase().includes(q)
      );
    });
  }, [data.parameters, query, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Input</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{data.stats.inputCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Alias Mapped</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-indigo-700">{data.stats.aliasMappedCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Valid</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-700">{data.stats.validCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Dynamic</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-violet-700">{data.stats.dynamicCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Review</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-amber-700">{data.stats.reviewCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Preserved</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{data.stats.preservedCount}</CardContent>
        </Card>
      </div>

      {data.aliasExamples.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Alias Normalization Examples</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.aliasExamples.slice(0, 12).map((ex) => (
              <Badge key={`${ex.originalLabel}-${ex.normalizedParameter}`} variant="outline" className="text-xs">
                {ex.originalLabel} → {ex.normalizedParameter}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Filter parameters…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border bg-white px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="VALID">VALID</option>
          <option value="VALID_DYNAMIC_PARAMETER">VALID_DYNAMIC_PARAMETER</option>
          <option value="REVIEW">REVIEW</option>
          <option value="REJECT">REJECT</option>
        </select>
      </div>

      <Card>
        <CardHeader><CardTitle>Parameters ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Original Label</th>
                <th className="px-4 py-2 font-semibold">Normalized</th>
                <th className="px-4 py-2 font-semibold">Value</th>
                <th className="px-4 py-2 font-semibold">Page</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr key={`${row.page}-${row.parameter}-${idx}`} className="border-b align-top last:border-0">
                  <td className="px-4 py-2">{row.originalLabel}</td>
                  <td className="px-4 py-2 font-medium">{row.parameter}</td>
                  <td className="px-4 py-2 max-w-xs break-words">{row.value}</td>
                  <td className="px-4 py-2">{row.page}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[row.validationStatus] || ''}`}>
                      {row.validationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2 max-w-md text-xs text-muted-foreground">{row.validationReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
