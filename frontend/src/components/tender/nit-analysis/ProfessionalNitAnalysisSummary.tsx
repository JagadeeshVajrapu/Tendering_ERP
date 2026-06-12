'use client';

import {
  ADDITIONAL_TENDER_PARAMETERS_CATEGORY,
  ALL_NIT_DISPLAY_CATEGORIES,
} from '@/types/nitAnalysisReport';

interface Props {
  totalCount: number;
  categoryCounts: Record<string, number>;
  confidenceTierCounts?: Record<string, number>;
  visibleByDefault?: number;
  compact?: boolean;
}

export function ProfessionalNitAnalysisSummary({
  totalCount,
  categoryCounts,
  confidenceTierCounts,
  visibleByDefault,
  compact,
}: Props) {
  const categories = ALL_NIT_DISPLAY_CATEGORIES.filter((cat) => (categoryCounts[cat] ?? 0) > 0);
  const tiers = confidenceTierCounts
    ? Object.entries(confidenceTierCounts).filter(([, n]) => n > 0)
    : [];

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <p className={`font-semibold text-slate-900 ${compact ? 'text-base' : 'text-lg'}`}>
        {totalCount} Parameter{totalCount === 1 ? '' : 's'} Extracted
      </p>
      {visibleByDefault !== undefined && visibleByDefault < totalCount && (
        <p className="text-xs text-slate-500">
          {visibleByDefault} shown by default · {totalCount - visibleByDefault} low-confidence hidden
        </p>
      )}
      {categories.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
          {categories.map((cat) => (
            <span
              key={cat}
              className={`rounded-full border px-3 py-1 font-medium shadow-sm ${
                cat === ADDITIONAL_TENDER_PARAMETERS_CATEGORY
                  ? 'border-violet-200 bg-violet-50 text-violet-800'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {cat} ({categoryCounts[cat]})
            </span>
          ))}
        </div>
      )}
      {tiers.length > 0 && !compact && (
        <div className="flex flex-wrap gap-2 text-xs">
          {tiers.map(([label, count]) => (
            <span key={label} className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
              {label}: {count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
