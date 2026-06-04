'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ExecutiveRecommendationView } from '@/components/tender/recommendation/ExecutiveRecommendationView';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ArrowLeft, Loader2, RefreshCw, Scale } from 'lucide-react';
import { getErrorMessage } from '@/lib/errorMessage';

export default function TenderRecommendationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuthStore();

  const { data: tenderData } = useQuery({
    queryKey: ['tender', id],
    queryFn: () => api.getTender(token!, id),
    enabled: !!token,
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['tender-recommendation', id],
    queryFn: () => api.getTenderRecommendation(token!, id),
    enabled: !!token,
    retry: 1,
  });

  const recommendation = data?.data;

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
            <Scale className="h-6 w-6 text-emerald-700" />
            Executive Recommendation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Final bid decision support from verified dataset and risk assessment.
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
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-600" />
          <p>Generating executive recommendation...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{getErrorMessage(error, 'Recommendation unavailable')}</p>
          <p className="mt-2 text-xs text-red-600">
            Master dataset and risk analysis must be complete before generating a recommendation.
          </p>
          <Link href={`/tenders/${id}`}>
            <Button variant="outline" className="mt-4">
              Go to Tender
            </Button>
          </Link>
        </div>
      )}

      {recommendation && !isLoading && (
        <ExecutiveRecommendationView data={recommendation} tenderTitle={tenderData?.data?.title} />
      )}
    </DashboardLayout>
  );
}
