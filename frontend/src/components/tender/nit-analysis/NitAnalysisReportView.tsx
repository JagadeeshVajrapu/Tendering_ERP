'use client';

import { FileText } from 'lucide-react';
import type { NitAnalysisReport } from '@/types/nitAnalysisReport';
import { TenderBusinessParametersTable } from '../TenderBusinessParametersTable';
import { NitAnalysisSectionsTable } from './NitAnalysisSectionsTable';

interface Props {
  report: NitAnalysisReport;
  tenderTitle?: string;
}

export function NitAnalysisReportView({ report, tenderTitle }: Props) {
  const stats = report.statistics;

  return (
    <div className="nit-analysis-report mx-auto max-w-6xl space-y-4 print:max-w-none">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-6 w-6 shrink-0 text-blue-700" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 print:text-lg">
              {tenderTitle || 'Tender Notice Analysis'}
            </h1>
            {report.originalName && (
              <p className="mt-1 text-sm text-slate-600">{report.originalName}</p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Tender parameters from Master Dataset · {stats.populatedFields} fields ·{' '}
              {stats.mappedCount} mapped from {stats.totalDiscovered} OCR labels · avg.{' '}
              {stats.averageConfidence}% confidence
            </p>
          </div>
        </div>
      </header>

      <TenderBusinessParametersTable parameters={report.tenderParameters} />

      {report.sections.length > 1 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Detailed sections</h2>
          <NitAnalysisSectionsTable sections={report.sections} />
        </div>
      )}
    </div>
  );
}
