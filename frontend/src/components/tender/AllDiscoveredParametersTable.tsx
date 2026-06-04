'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search } from 'lucide-react';
import type { DiscoveredParameterRow } from '@/types/discoveredParameter';

interface Props {
  parameters: DiscoveredParameterRow[];
  totalFound?: number;
  pagesScanned?: number;
  headerExtra?: React.ReactNode;
}

export function AllDiscoveredParametersTable({
  parameters,
  totalFound,
  pagesScanned,
  headerExtra,
}: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parameters;
    return parameters.filter(
      (r) =>
        r.parameterName.toLowerCase().includes(q) ||
        r.parameterValue.toLowerCase().includes(q)
    );
  }, [parameters, search]);

  const total = totalFound ?? parameters.length;

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="border-b bg-slate-50/80 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">All Discovered Parameters</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {total} parameter{total === 1 ? '' : 's'} from OCR
              {pagesScanned != null ? ` · ${pagesScanned} pages` : ''} — no predefined schema
            </p>
          </div>
          {headerExtra}
        </div>
        <div className="relative mt-2 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search parameter or value…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted-foreground">
            {search ? 'No matching parameters.' : 'No parameters extracted from this document yet.'}
          </p>
        ) : (
          <div className="max-h-[75vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-slate-100">
                <TableRow>
                  <TableHead className="w-10 font-semibold">#</TableHead>
                  <TableHead className="min-w-[200px] font-semibold">Parameter</TableHead>
                  <TableHead className="min-w-[280px] font-semibold">Value</TableHead>
                  <TableHead className="w-16 font-semibold">Page</TableHead>
                  <TableHead className="w-20 font-semibold">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row, index) => (
                  <TableRow
                    key={row.id ?? `${row.sourcePage}-${index}-${row.parameterName}`}
                    className="align-top hover:bg-slate-50/80"
                  >
                    <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium text-slate-800">{row.parameterName}</TableCell>
                    <TableCell className="whitespace-pre-wrap break-words text-slate-900">
                      {row.parameterValue}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {row.sourcePage}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {row.confidence}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
