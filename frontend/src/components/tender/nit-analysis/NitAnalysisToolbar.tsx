'use client';

import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  ALL_NIT_DISPLAY_CATEGORIES,
  type NitAnalysisConfidenceFilter,
  type NitAnalysisReport,
} from '@/types/nitAnalysisReport';

export interface NitAnalysisFilters {
  search: string;
  category: string;
  confidence: NitAnalysisConfidenceFilter;
  page: string;
  showLowConfidence: boolean;
}

interface Props {
  report: NitAnalysisReport;
  filters: NitAnalysisFilters;
  onChange: (filters: NitAnalysisFilters) => void;
}

const CONFIDENCE_OPTIONS: { value: NitAnalysisConfidenceFilter; label: string }[] = [
  { value: 'all', label: 'All confidence' },
  { value: 'verified', label: 'Verified (95–100)' },
  { value: 'high', label: 'High (85–94)' },
  { value: 'review', label: 'Review (70–84)' },
  { value: 'low', label: 'Low (<70)' },
];

export function NitAnalysisToolbar({ report, filters, onChange }: Props) {
  const categories = ALL_NIT_DISPLAY_CATEGORIES.filter(
    (cat) => (report.statistics.categoryCounts[cat] ?? 0) > 0
  );

  const pages = Array.from(
    new Set(report.tenderParameters.map((p) => p.sourcePage).filter(Boolean))
  ).sort((a, b) => a - b);

  return (
    <div className="no-print space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Filter className="h-4 w-4" />
        Search &amp; filter
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search parameter or value…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat} ({report.statistics.categoryCounts[cat]})
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.confidence}
          onChange={(e) =>
            onChange({
              ...filters,
              confidence: e.target.value as NitAnalysisConfidenceFilter,
            })
          }
        >
          {CONFIDENCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.page}
          onChange={(e) => onChange({ ...filters, page: e.target.value })}
        >
          <option value="">All pages</option>
          {pages.map((p) => (
            <option key={p} value={String(p)}>
              Page {p}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={filters.showLowConfidence}
          onChange={(e) => onChange({ ...filters, showLowConfidence: e.target.checked })}
          className="rounded border-slate-300"
        />
        Show low-confidence parameters (below 70%)
      </label>
    </div>
  );
}

export function filterNitAnalysisReport(
  report: NitAnalysisReport,
  filters: NitAnalysisFilters
): NitAnalysisReport {
  const q = filters.search.trim().toLowerCase();

  const matchRow = (row: (typeof report.tenderParameters)[0]) => {
    if (!filters.showLowConfidence && row.hiddenByDefault) return false;
    if (filters.confidence !== 'all' && row.confidenceTier !== filters.confidence) return false;
    if (filters.page && String(row.sourcePage) !== filters.page) return false;
    if (filters.category && row.category !== filters.category) return false;
    if (!q) return true;
    return (
      row.label.toLowerCase().includes(q) ||
      row.value.toLowerCase().includes(q) ||
      (row.normalizedParameter || '').toLowerCase().includes(q)
    );
  };

  const sections = report.sections
    .map((section) => ({
      ...section,
      fields: section.fields.filter(matchRow),
    }))
    .filter((s) => s.fields.length > 0);

  return {
    ...report,
    sections,
    tenderParameters: report.tenderParameters.filter(matchRow),
  };
}
