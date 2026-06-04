'use client';

import { Search, Filter, FileSpreadsheet, FileDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { DatasetFilterMode } from '@/types/masterDataset';

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  filter: DatasetFilterMode;
  onFilterChange: (value: DatasetFilterMode) => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  resultCount: number;
  totalCount: number;
}

const FILTER_OPTIONS: { value: DatasetFilterMode; label: string }[] = [
  { value: 'all', label: 'All Fields' },
  { value: 'populated', label: 'Populated Only' },
  { value: 'low_confidence', label: 'Low Confidence (<80)' },
  { value: 'missing', label: 'Missing Values' },
];

export function DatasetToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onExportCsv,
  onExportExcel,
  resultCount,
  totalCount,
}: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search parameters or values..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 shrink-0 text-slate-400" />
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as DatasetFilterMode)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Showing {resultCount} of {totalCount} fields
        </span>
        <Button variant="outline" size="sm" onClick={onExportCsv}>
          <FileDown className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button variant="outline" size="sm" onClick={onExportExcel}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
      </div>
    </div>
  );
}
