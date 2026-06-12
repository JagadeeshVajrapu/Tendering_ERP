'use client';

import { use } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useChecklistWorkflowMutation } from '@/components/tender/checklist/useChecklistWorkflowMutation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProfessionalNitChecklistView } from '@/components/tender/checklist/ProfessionalNitChecklistView';
import { TenderPageHeader } from '@/components/tender/TenderPageHeader';
import { useTenderNavContext } from '@/components/tender/useTenderNavContext';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errorMessage';
import { Loader2, RefreshCw } from 'lucide-react';

export default function TenderChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();
  const { tender, analysisComplete, hasReport, submissionStatus } = useTenderNavContext(id);

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
        pageTitle="Checklist & Compliance"
        pageDescription="Mandatory and optional compliance documents generated from NIT analysis."
      />

      <div className="mb-6 flex justify-end">
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
