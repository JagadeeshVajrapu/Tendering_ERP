'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  PARAMETER_GROUP_ORDER,
  ParameterDiscoveryResult,
  ParameterGroup,
} from '@/types/parameterDiscovery';
import { Search } from 'lucide-react';

const GROUP_COLORS: Record<ParameterGroup, string> = {
  'General Information': 'bg-slate-100 text-slate-900 border-slate-200',
  'Financial Information': 'bg-emerald-100 text-emerald-900 border-emerald-200',
  'Important Dates': 'bg-blue-100 text-blue-900 border-blue-200',
  'Eligibility Criteria': 'bg-amber-100 text-amber-900 border-amber-200',
  'Technical Requirements': 'bg-indigo-100 text-indigo-900 border-indigo-200',
  'Compliance Requirements': 'bg-purple-100 text-purple-900 border-purple-200',
  'Contact Information': 'bg-cyan-100 text-cyan-900 border-cyan-200',
};

const GROUP_DESCRIPTIONS: Record<ParameterGroup, string> = {
  'General Information': 'Tender ID, authority, location, title, and other header fields',
  'Financial Information': 'EMD, tender value, fees, turnover, and monetary amounts',
  'Important Dates': 'Publish, submission, opening, closing, and validity dates',
  'Eligibility Criteria': 'Qualification, experience, registration, and bidder requirements',
  'Technical Requirements': 'Scope, specifications, manpower, quantities, and deliverables',
  'Compliance Requirements': 'Statutory, BG, MAF, insurance, and legal obligations',
  'Contact Information': 'Officers, phone, email, and communication details',
};

type ViewMode = 'grouped' | 'all';

function ParameterTable({
  items,
  showGroup = false,
}: {
  items: ParameterDiscoveryResult['parameters'];
  showGroup?: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 border-b bg-slate-50">
        <tr className="text-left text-xs text-muted-foreground">
          <th className="px-4 py-2 font-semibold w-[20%]">Parameter</th>
          <th className="px-4 py-2 font-semibold w-[30%]">Value</th>
          {showGroup && <th className="px-4 py-2 font-semibold w-[18%]">Group</th>}
          <th className="px-4 py-2 font-semibold w-12">Page</th>
          <th className="px-4 py-2 font-semibold w-14">Conf.</th>
          {!showGroup && <th className="px-4 py-2 font-semibold">Source</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((p, i) => (
          <tr
            key={`${p.pageNumber}-${p.parameterName}-${i}`}
            className="border-b last:border-0 hover:bg-slate-50/80 align-top"
          >
            <td className="px-4 py-2 font-medium">{p.parameterName}</td>
            <td className="px-4 py-2 font-mono text-slate-800 break-words">{p.parameterValue}</td>
            {showGroup && (
              <td className="px-4 py-2 text-xs text-muted-foreground">{p.category}</td>
            )}
            <td className="px-4 py-2 text-muted-foreground">{p.pageNumber}</td>
            <td className="px-4 py-2 text-muted-foreground">{p.confidence}%</td>
            {!showGroup && (
              <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs truncate" title={p.sourceText}>
                {p.sourceText}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupSection({
  group,
  items,
}: {
  group: ParameterGroup;
  items: ParameterDiscoveryResult['parameters'];
}) {
  if (!items.length) return null;

  return (
    <Card className="overflow-hidden border-l-4" style={{ borderLeftColor: 'var(--group-accent, #94a3b8)' }}>
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span
                className={`rounded-md border px-2.5 py-1 text-sm font-semibold ${GROUP_COLORS[group]}`}
              >
                {group}
              </span>
              <Badge variant="outline">{items.length}</Badge>
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{GROUP_DESCRIPTIONS[group]}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[420px] overflow-auto">
          <ParameterTable items={items} />
        </div>
      </CardContent>
    </Card>
  );
}

export function DiscoveredParametersPanel({ data }: { data: ParameterDiscoveryResult }) {
  const [query, setQuery] = useState('');
  const [pageFilter, setPageFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const p = pageFilter.trim();
    return data.parameters.filter((row) => {
      if (p && String(row.pageNumber) !== p) return false;
      if (!q) return true;
      return (
        row.parameterName.toLowerCase().includes(q) ||
        row.parameterValue.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q) ||
        (row.sourceText || '').toLowerCase().includes(q)
      );
    });
  }, [data.parameters, query, pageFilter]);

  const nonEmptyGroups = PARAMETER_GROUP_ORDER.filter(
    (g) => (data.grouped[g] ?? []).length > 0
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Discovered Parameters</h2>
          <p className="text-sm text-muted-foreground">
            Auto-grouped into {nonEmptyGroups} sections · {data.pagesScanned} pages scanned ·{' '}
            {data.totalFound} pairs
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {data.totalFound} total
        </Badge>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search parameter, value, or group…"
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
        <div className="flex rounded-lg border p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setViewMode('grouped')}
            className={`rounded-md px-3 py-1.5 ${viewMode === 'grouped' ? 'bg-slate-900 text-white' : 'text-muted-foreground hover:bg-slate-50'}`}
          >
            Grouped sections
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`rounded-md px-3 py-1.5 ${viewMode === 'all' ? 'bg-slate-900 text-white' : 'text-muted-foreground hover:bg-slate-50'}`}
          >
            All ({data.totalFound})
          </button>
        </div>
      </div>

      {viewMode === 'grouped' ? (
        <div className="space-y-6">
          {PARAMETER_GROUP_ORDER.map((group) => {
            const items = (data.grouped[group] ?? []).filter((p) =>
              filtered.some(
                (f) =>
                  f.pageNumber === p.pageNumber &&
                  f.parameterName === p.parameterName &&
                  f.parameterValue === p.parameterValue
              )
            );
            return <GroupSection key={group} group={group} items={items} />;
          })}
        </div>
      ) : (
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base font-medium">
              All parameters · showing {filtered.length} of {data.totalFound}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[70vh] overflow-auto">
              <ParameterTable items={filtered} showGroup />
            </div>
          </CardContent>
        </Card>
      )}

      {data.totalFound === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No parameters detected. Run OCR first, then re-scan from this page or Field Locator.
        </p>
      )}
    </div>
  );
}
