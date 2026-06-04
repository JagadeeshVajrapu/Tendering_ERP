'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { NitAnalysisReportView } from '@/components/tender/nit-analysis/NitAnalysisReportView';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ArrowLeft, Loader2, Printer, RefreshCw, FileText } from 'lucide-react';
import { getErrorMessage } from '@/lib/errorMessage';

export default function TenderNitAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuthStore();

  const { data: tenderData } = useQuery({
    queryKey: ['tender', id],
    queryFn: () => api.getTender(token!, id),
    enabled: !!token,
  });

  const [refresh, setRefresh] = useState(false);

  const {
    data: reportResponse,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['tender-nit-analysis', id, refresh],
    queryFn: () => api.getTenderNitAnalysis(token!, id, refresh),
    enabled: !!token,
    retry: 1,
  });

  const tender = tenderData?.data;
  const report = reportResponse?.data;

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div>
          <Link
            href={`/tenders/${id}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tender
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <FileText className="h-6 w-6 text-blue-700" />
            NIT Analysis
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tender Number, EMD Amount, Name of Work, Scope of Work, dates, and other mapped fields —
            not raw OCR address fragments.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefresh(true);
              refetch();
            }}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!report}>
            <Printer className="mr-2 h-4 w-4" />
            Print / PDF
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-600" />
          <p>Running discovery, mapping, and NIT analysis…</p>
        </div>
      )}

      {error && !isLoading && (
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

      {report && !isLoading && (
        <NitAnalysisReportView report={report} tenderTitle={tender?.title} />
      )}
    </DashboardLayout>
  );
}
