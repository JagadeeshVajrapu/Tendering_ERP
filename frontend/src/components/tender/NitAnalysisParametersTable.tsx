'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { getErrorMessage } from '@/lib/errorMessage';
import { NitAnalysisSectionsTable } from './nit-analysis/NitAnalysisSectionsTable';
import { ProfessionalNitAnalysisSummary } from './nit-analysis/ProfessionalNitAnalysisSummary';
import { NitAnalysisChecklistEmbed } from './checklist/NitAnalysisChecklistEmbed';

interface Props {
  tenderId: string;
  token: string;
  userRole?: string;
  jobRunning?: boolean;
  ocrReady?: boolean;
  analysisComplete?: boolean;
}

export function NitAnalysisParametersTable({
  tenderId,
  token,
  userRole,
  jobRunning,
  ocrReady = true,
  analysisComplete = false,
}: Props) {
  const [refresh, setRefresh] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['tender-nit-analysis', tenderId, refresh],
    queryFn: () => api.getTenderNitAnalysis(token, tenderId, refresh),
    enabled: !!token && ocrReady,
    retry: 1,
    staleTime: analysisComplete ? 120_000 : 0,
    refetchInterval: jobRunning ? 2000 : false,
  });

  const report = data?.data;
  const sections = (report?.sections ?? []).filter((s) => s.id !== 'risk');
  const sectionFieldCount = sections.reduce((sum, s) => sum + (s.fields?.length ?? 0), 0);
  const totalCount =
    sectionFieldCount ||
    report?.statistics?.populatedFields ||
    report?.tenderParameters?.length ||
    0;

  if (!ocrReady) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        Starting analysis…
      </div>
    );
  }

  if (isLoading && !report) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        {jobRunning ? 'Building Professional NIT Analysis…' : 'Loading NIT Analysis…'}
      </div>
    );
  }

  if (error && !report) {
    return (
      <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
        {getErrorMessage(error, 'NIT Analysis not ready yet')}
      </p>
    );
  }

  if (!totalCount) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-sm text-muted-foreground">
        {jobRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            Extracting validated parameters — table updates automatically
          </>
        ) : (
          <>
            <p>No validated parameters in master dataset yet.</p>
            {analysisComplete && (
              <Button
                variant="outline"
                size="sm"
                disabled={isFetching}
                onClick={() => {
                  setRefresh(true);
                  refetch();
                }}
              >
                {isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Rebuild NIT table
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b bg-slate-50/80 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Professional NIT Analysis</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Core + dynamic parameters from validated master dataset
              </p>
              <div className="mt-3">
                <ProfessionalNitAnalysisSummary
                  totalCount={totalCount}
                  categoryCounts={report?.statistics?.categoryCounts ?? {}}
                  compact
                />
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {analysisComplete && (
                <Link href={`/tenders/${tenderId}/nit-analysis`}>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Full report
                  </Button>
                </Link>
              )}
              {analysisComplete ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isFetching}
                  onClick={() => {
                    setRefresh(true);
                    refetch();
                  }}
                >
                  {isFetching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Refresh
                </Button>
              ) : (
                <span className="flex items-center gap-2 text-xs text-blue-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Updating…
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4 pt-4">
          <NitAnalysisSectionsTable sections={sections} />
        </CardContent>
      </Card>

      <NitAnalysisChecklistEmbed
        tenderId={tenderId}
        token={token}
        userRole={userRole}
        analysisRunning={!!jobRunning}
        inline
      />
    </div>
  );
}
