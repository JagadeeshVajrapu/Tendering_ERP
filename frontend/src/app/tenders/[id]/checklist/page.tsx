'use client';

import { use } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useChecklistWorkflowMutation } from '@/components/tender/checklist/useChecklistWorkflowMutation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProfessionalNitChecklistView } from '@/components/tender/checklist/ProfessionalNitChecklistView';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errorMessage';
import { ArrowLeft, CheckSquare, Loader2, RefreshCw } from 'lucide-react';

export default function TenderChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();

  const {
    data: checklistResponse,
    isLoading,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['tender-dynamic-checklist', id],
    queryFn: () => api.getTenderDynamicChecklist(token!, id, false),
    enabled: !!token,
    retry: 1,
    staleTime: 30_000,
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.getTenderDynamicChecklist(token!, id, true),
    onSuccess: (data) => {
      queryClient.setQueryData(['tender-dynamic-checklist', id], data);
    },
  });

  const { handleWorkflow, workflowError, pendingItemId } = useChecklistWorkflowMutation(id, token!);

  const checklist = checklistResponse?.data;
  const isRefreshing = isFetching || refreshMutation.isPending;

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
            <CheckSquare className="h-6 w-6 text-blue-700" />
            Checklist &amp; Compliance Module
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-driven document requirement detection with executive verification, section-wise compliance tracking, and tender readiness monitoring.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center py-20 text-muted-foreground">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-600" />
          Building compliance checklist…
        </div>
      )}

      {error && !checklist && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {getErrorMessage(error, 'Failed to load checklist')}
        </div>
      )}

      {workflowError && (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {workflowError}
        </p>
      )}

      {checklist && (
        <ProfessionalNitChecklistView
          data={checklist}
          userRole={user?.role}
          onWorkflowAction={token ? handleWorkflow : undefined}
          pendingItemId={pendingItemId}
        />
      )}
    </DashboardLayout>
  );
}
