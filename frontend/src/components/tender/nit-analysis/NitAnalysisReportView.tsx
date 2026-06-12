'use client';

import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import type { NitAnalysisReport } from '@/types/nitAnalysisReport';
import { NitAnalysisSectionsTable } from './NitAnalysisSectionsTable';
import { ProfessionalNitAnalysisSummary } from './ProfessionalNitAnalysisSummary';
import {
  NitAnalysisToolbar,
  filterNitAnalysisReport,
  type NitAnalysisFilters,
} from './NitAnalysisToolbar';
import { NitAnalysisChecklistEmbed } from '@/components/tender/checklist/NitAnalysisChecklistEmbed';

interface Props {
  report: NitAnalysisReport;
  tenderTitle?: string;
  analysisInProgress?: boolean;
  tenderId?: string;
  token?: string;
  userRole?: string;
}

const DEFAULT_FILTERS: NitAnalysisFilters = {
  search: '',
  category: '',
  confidence: 'all',
  page: '',
  showLowConfidence: false,
};

export function NitAnalysisReportView({
  report,
  tenderTitle,
  analysisInProgress,
  tenderId,
  token,
  userRole,
}: Props) {
  const [filters, setFilters] = useState<NitAnalysisFilters>(DEFAULT_FILTERS);
  const filtered = useMemo(() => filterNitAnalysisReport(report, filters), [report, filters]);

  const stats = report.statistics;
  const sections = filtered.sections.filter((s) => s.id !== 'risk');
  const identity = report.sections.find((s) => s.id === 'identity');
  const headline = identity?.fields.find((f) => f.key === 'tenderTitle' || f.key === 'workName');
  const totalCount =
    stats.totalParametersExtracted ?? stats.populatedFields ?? report.tenderParameters.length;

  return (
    <div className="nit-analysis-report mx-auto max-w-6xl space-y-6 print:max-w-none">
      <header className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm print:shadow-none">
        <div className="flex items-start gap-3">
          <FileText className="mt-1 h-7 w-7 shrink-0 text-blue-800" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Enterprise Dynamic NIT Analysis
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 print:text-xl">
              {headline?.value || tenderTitle || 'Tender Notice Analysis'}
            </h1>
            {report.originalName && (
              <p className="mt-1 text-sm text-slate-600">{report.originalName}</p>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Enterprise master dataset
              {stats.serviceCategory ? ` · ${stats.serviceCategory}` : ''}
              {stats.masterDatasetVersion ? ` · v${stats.masterDatasetVersion}` : ''}
              {' · '}avg. {stats.averageConfidence}% confidence · Generated{' '}
              {new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5">
          <ProfessionalNitAnalysisSummary
            totalCount={totalCount}
            categoryCounts={stats.categoryCounts ?? {}}
            confidenceTierCounts={stats.confidenceTierCounts}
            visibleByDefault={stats.visibleByDefault}
          />
        </div>
      </header>

      {analysisInProgress && (
        <p className="rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
          Analysis still running — parameters update automatically from the master dataset.
        </p>
      )}

      <NitAnalysisToolbar report={report} filters={filters} onChange={setFilters} />

      <NitAnalysisSectionsTable sections={sections} />

      {tenderId && token && (
        <NitAnalysisChecklistEmbed
          tenderId={tenderId}
          token={token}
          userRole={userRole}
          analysisRunning={analysisInProgress}
          inline
        />
      )}
    </div>
  );
}
