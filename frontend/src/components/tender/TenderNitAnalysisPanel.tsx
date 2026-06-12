'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Loader2, FileText, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessage';
import { NitAnalysisSectionsTable } from './nit-analysis/NitAnalysisSectionsTable';
import { ProfessionalNitAnalysisSummary } from './nit-analysis/ProfessionalNitAnalysisSummary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  tenderId: string;
  token: string;
  tenderTitle?: string;
  jobRunning?: boolean;
  /** Wait until OCR pages are likely stored before first fetch */
  ocrReady?: boolean;
}

export function TenderNitAnalysisPanel({
  tenderId,
  token,
  tenderTitle,
  jobRunning,
  ocrReady = true,
}: Props) {
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['tender-nit-analysis', tenderId],
    queryFn: () => api.getTenderNitAnalysis(token, tenderId, false),
    enabled: !!token && ocrReady,
    retry: 1,
    staleTime: 30_000,
    refetchInterval: jobRunning ? 8000 : false,
  });

  const report = data?.data;
  const awaitingOcr =
    report?.pipeline?.steps?.includes('awaiting_ocr') ||
    report?.pipeline?.steps?.includes('awaiting_master_dataset');
  const parameterSections =
    report?.sections?.filter((s) => s.id !== 'risk') ?? [];
  const hasParameterSections = parameterSections.some((s) => s.fields.length > 0);
  const showLoader = (!ocrReady || isLoading || awaitingOcr) && !hasParameterSections;
  const displaySections = jobRunning
    ? parameterSections.filter((s) => s.fields.length > 0)
    : report?.sections ?? [];

  return (
    <Card className="mt-6 border-blue-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 border-b bg-gradient-to-r from-blue-50/80 to-white pb-4">
        <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
          <FileText className="h-5 w-5 text-blue-700" />
          NIT Analysis
          {isFetching && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-label="Updating" />
          )}
        </CardTitle>
        {hasParameterSections && (
          <Link href={`/tenders/${tenderId}/nit-analysis`}>
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Full report
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent className="pt-6">
        {showLoader && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p>
              {!ocrReady || awaitingOcr
                ? 'Waiting for OCR text extraction to finish…'
                : 'Extracting NIT parameters from the document…'}
            </p>
            {jobRunning && (
              <p className="text-xs text-slate-500">
                The NIT table will populate shortly after OCR completes.
              </p>
            )}
          </div>
        )}

        {error && !hasParameterSections && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {getErrorMessage(error, 'NIT analysis not ready yet')}
            {jobRunning && ' — extraction is still running.'}
          </p>
        )}

        {jobRunning && ocrReady && !awaitingOcr && (
          <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
            Analysis in progress — core and additional tender parameters appear as they are validated.
          </p>
        )}

        {hasParameterSections && report && (
          <div className="space-y-4">
            <ProfessionalNitAnalysisSummary
              totalCount={
                report.statistics.totalParametersExtracted ?? report.statistics.populatedFields
              }
              categoryCounts={report.statistics.categoryCounts ?? {}}
              compact
            />
            <NitAnalysisSectionsTable sections={displaySections} />
          </div>
        )}

        {!showLoader && !hasParameterSections && !error && jobRunning && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Extracting tender parameters from OCR… this updates automatically every few seconds.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
