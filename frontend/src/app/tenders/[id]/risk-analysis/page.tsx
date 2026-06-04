'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TenderRiskAnalysisView } from '@/components/tender/risk-analysis/TenderRiskAnalysisView';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ArrowLeft, Loader2, RefreshCw, Shield } from 'lucide-react';
import { getErrorMessage } from '@/lib/errorMessage';

export default function TenderRiskAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuthStore();

  const { data: tenderData } = useQuery({
    queryKey: ['tender', id],
    queryFn: () => api.getTender(token!, id),
    enabled: !!token,
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['tender-risk-analysis', id],
    queryFn: () => api.getTenderRiskAnalysis(token!, id),
    enabled: !!token,
    retry: 1,
  });

  const analysis = data?.data;

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/tenders/${id}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tender
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Shield className="h-6 w-6 text-red-700" />
            Risk Analysis
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Financial, technical, eligibility, timeline, and compliance risk assessment.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-red-600" />
          <p>Running risk analysis from master dataset...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{getErrorMessage(error, 'Risk analysis unavailable')}</p>
          <p className="mt-2 text-xs text-red-600">
            Extraction and validation must complete before risk analysis can run.
          </p>
          <Link href={`/tenders/${id}`}>
            <Button variant="outline" className="mt-4">
              Go to Tender
            </Button>
          </Link>
        </div>
      )}

      {analysis && !isLoading && (
        <TenderRiskAnalysisView analysis={analysis} tenderTitle={tenderData?.data?.title} />
      )}
    </DashboardLayout>
  );
}
