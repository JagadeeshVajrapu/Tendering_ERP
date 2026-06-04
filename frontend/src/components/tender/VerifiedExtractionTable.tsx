'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { VerifiedTableRow, TenderVerifiedSummary } from '@/types/verifiedSummary';
import { Search, Database } from 'lucide-react';

const LOW_CONFIDENCE = 80;
const NOT_FOUND = 'Not Found';

interface Props {
  summary: TenderVerifiedSummary;
  tenderId: string;
}

export function VerifiedExtractionTable({ summary, tenderId }: Props) {
  const [search, setSearch] = useState('');
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summary.rows.filter((row) => {
      if (showMissingOnly && row.found) return false;
      if (!q) return true;
      return (
        row.parameter.toLowerCase().includes(q) ||
        row.value.toLowerCase().includes(q)
      );
    });
  }, [summary.rows, search, showMissingOnly]);

  const recColors: Record<string, string> = {
    'Apply Immediately': 'bg-emerald-600 text-white',
    'Apply With Caution': 'bg-amber-500 text-white',
    'Need Manual Review': 'bg-blue-600 text-white',
    'Do Not Apply': 'bg-red-600 text-white',
  };

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="border-b bg-slate-50/80 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5 text-blue-600" />
              Verified Tender Data
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Master Tender Dataset · {summary.statistics.foundParameters}/
              {summary.statistics.totalParameters} fields ·{' '}
              {summary.statistics.averageConfidence}% avg confidence
            </p>
          </div>
          {summary.recommendation && (
            <span
              className={cn(
                'inline-flex rounded-lg px-3 py-1.5 text-sm font-bold',
                recColors[summary.recommendation] || 'bg-slate-600 text-white'
              )}
            >
              {summary.recommendation}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search parameter or value..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showMissingOnly}
              onChange={(e) => setShowMissingOnly(e.target.checked)}
              className="rounded"
            />
            Show missing only
          </label>
          <div className="flex gap-2 text-xs">
            <Link href={`/tenders/${tenderId}/dataset`} className="text-blue-600 hover:underline">
              Full dataset
            </Link>
            <span className="text-slate-300">|</span>
            <Link href={`/tenders/${tenderId}/nit-analysis`} className="text-blue-600 hover:underline">
              NIT report
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="max-h-[520px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-100">
              <TableRow>
                <TableHead className="min-w-[200px] font-bold">Parameter</TableHead>
                <TableHead className="min-w-[240px] font-bold">Value</TableHead>
                <TableHead className="w-[90px] font-bold">Confidence</TableHead>
                <TableHead className="w-[90px] font-bold">Source Page</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <VerifiedRow key={row.parameter} row={row} />
              ))}
            </TableBody>
          </Table>
        </div>
        {filteredRows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No rows match your filter.</p>
        )}
      </CardContent>
    </Card>
  );
}

function VerifiedRow({ row }: { row: VerifiedTableRow }) {
  const missing = row.value === NOT_FOUND;
  const lowConf = !missing && row.confidence !== null && row.confidence < LOW_CONFIDENCE;

  return (
    <TableRow
      className={cn(
        lowConf && 'bg-amber-50/60',
        missing && 'bg-slate-50/80'
      )}
    >
      <TableCell className="align-top font-medium text-slate-800">{row.parameter}</TableCell>
      <TableCell
        className={cn(
          'align-top text-sm',
          missing ? 'italic text-slate-400' : 'text-slate-900'
        )}
      >
        <span className="line-clamp-3" title={row.value}>
          {row.value}
        </span>
      </TableCell>
      <TableCell className="align-top">
        {missing ? (
          <span className="text-slate-400">—</span>
        ) : (
          <Badge
            variant="outline"
            className={cn(
              'tabular-nums',
              lowConf && 'border-amber-300 bg-amber-50 text-amber-800'
            )}
          >
            {row.confidence}%
          </Badge>
        )}
      </TableCell>
      <TableCell className="align-top text-sm tabular-nums text-slate-600">
        {row.sourcePage ? `p. ${row.sourcePage}` : '—'}
      </TableCell>
    </TableRow>
  );
}
