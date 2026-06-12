'use client';

import { use, useCallback } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { NitAnalysisReportView } from '@/components/tender/nit-analysis/NitAnalysisReportView';
import { TenderPageHeader } from '@/components/tender/TenderPageHeader';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Download, FileSpreadsheet, FileText, Loader2, Printer, RefreshCw } from 'lucide-react';
import { getErrorMessage } from '@/lib/errorMessage';
import {
  exportNitAnalysisExcel,
  exportNitAnalysisJson,
  exportNitAnalysisPdfFromApi,
} from '@/lib/nitAnalysisExport';

export default function TenderNitAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: tenderData } = useQuery({
    queryKey: ['tender', id],
    queryFn: () => api.getTender(token!, id),
    enabled: !!token,
  });

  const { data: analysisData } = useQuery({
    queryKey: ['analysis', id],
    queryFn: () => api.getTenderAnalysis(token!, id),
    enabled: !!token,
    retry: false,
  });

  const { data: submissionData } = useQuery({
    queryKey: ['submission-tracking', id],
    queryFn: () => api.getSubmissionTrackingDashboard(token!, id),
    enabled: !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const job = analysisData?.data?.job;
  const analysisRunning = !!job && job.status !== 'completed' && job.status !== 'failed';

  const {
    data: reportResponse,
    isLoading,
    error,
    isFetching,
  } = useQuery({
    queryKey: ['tender-nit-analysis', id],
    queryFn: () => api.getTenderNitAnalysis(token!, id, false),
    enabled: !!token,
    retry: 1,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
    refetchInterval: analysisRunning ? 8000 : false,
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.getTenderNitAnalysis(token!, id, true),
    onSuccess: (data) => {
      queryClient.setQueryData(['tender-nit-analysis', id], data);
    },
  });

  const handleRefresh = useCallback(() => {
    refreshMutation.mutate();
  }, [refreshMutation]);

  const tender = tenderData?.data;
  const submissionStatus = submissionData?.data?.submissionStatus;
  const report = reportResponse?.data;
  const analysisComplete = job?.status === 'completed';
  const hasReport = !!analysisData?.data?.report;
  const showInitialLoader = isLoading && !report;
  const isRefreshing = isFetching || refreshMutation.isPending;

  return (
    <DashboardLayout>
      <div className="no-print">
        <TenderPageHeader
          tenderId={id}
          title={tender?.title}
          status={tender?.status}
          currentStage={tender?.currentStage}
          submissionStatus={submissionStatus}
          userRole={user?.role}
          analysisComplete={analysisComplete}
          hasReport={hasReport}
          showBack
          pageTitle="NIT Analysis"
          pageDescription="Enterprise master dataset with validated parameters and compliance insights."
        />
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end no-print">
        <div className="hidden sm:block" />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!report}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          {report && token && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportNitAnalysisPdfFromApi(token, id, `NIT_Analysis_${id}`)
                }
              >
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportNitAnalysisExcel(report, `NIT_Analysis_${id}`)}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportNitAnalysisJson(report, `NIT_Analysis_${id}`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {showInitialLoader && (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-600" />
            <p>Loading NIT analysis…</p>
          </div>
          <div className="animate-pulse space-y-4 rounded-xl border border-slate-200 p-6">
            <div className="h-6 w-1/3 rounded bg-slate-200" />
            <div className="h-4 w-2/3 rounded bg-slate-100" />
            <div className="mt-6 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-slate-50" />
              ))}
            </div>
          </div>
        </div>
      )}

      {error && !report && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{getErrorMessage(error, 'Failed to generate NIT analysis')}</p>
          <p className="mt-2 text-xs text-red-600">
            Upload a PDF and wait for OCR processing to finish, then refresh.
          </p>
          <Link href={`/tenders/${id}`}>
            <Button variant="outline" className="mt-4">
              Go to Tender
            </Button>
          </Link>
        </div>
      )}

      {report && (
        <div className="space-y-3">
          {isRefreshing && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground no-print">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Updating from latest extraction…
            </p>
          )}
          <NitAnalysisReportView
            report={report}
            tenderTitle={tender?.title}
            analysisInProgress={analysisRunning}
            tenderId={id}
            token={token || undefined}
            userRole={user?.role}
          />
        </div>
      )}

      {error && report && (
        <p className="text-xs text-amber-700 no-print">
          Could not refresh: {getErrorMessage(error, 'Update failed')}. Showing last loaded report.
        </p>
      )}
    </DashboardLayout>
  );
}
