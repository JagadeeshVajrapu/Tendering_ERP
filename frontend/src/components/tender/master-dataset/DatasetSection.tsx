'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExpandableFieldRow } from './ExpandableFieldRow';
import type { DatasetRowView } from '@/types/masterDataset';
import type { MasterDatasetSection } from '@/lib/masterDatasetSections';

interface Props {
  section: MasterDatasetSection;
  rows: DatasetRowView[];
  expandAll?: boolean;
}

export function DatasetSection({ section, rows, expandAll }: Props) {
  if (!rows.length) return null;

  const populated = rows.filter((r) => r.field.value.trim()).length;

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg text-slate-900">{section.title}</CardTitle>
            <CardDescription className="mt-1">{section.description}</CardDescription>
          </div>
          <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {populated}/{rows.length} populated
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="w-10" />
                <TableHead className="min-w-[180px] font-semibold text-slate-700">Parameter</TableHead>
                <TableHead className="min-w-[240px] font-semibold text-slate-700">Value</TableHead>
                <TableHead className="w-[120px] font-semibold text-slate-700">Confidence</TableHead>
                <TableHead className="w-[100px] font-semibold text-slate-700">Source Page</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <ExpandableFieldRow key={row.key} row={row} forceExpanded={expandAll} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
