'use client';

import { use } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EnterpriseFeasibilityReportView } from '@/components/tender/feasibility/EnterpriseFeasibilityReportView';
import { FeasibilityReportView } from '@/components/tender/FeasibilityReportView';
import { TenderPageHeader } from '@/components/tender/TenderPageHeader';
import { useTenderNavContext } from '@/components/tender/useTenderNavContext';
import { ErrorState, LoadingState } from '@/components/shared/QueryState';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errorMessage';
import type { EnterpriseFeasibilityReport, MdFeasibilityAction } from '@/types/enterpriseFeasibilityReport';

export default function FeasibilityReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();
  const { tender, analysisComplete, hasReport, submissionStatus } = useTenderNavContext(id);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['report', id],
    queryFn: () => api.getFeasibilityReport(token!, id),
    enabled: !!token,
    retry: false,
  });

  const mdActionMutation = useMutation({
    mutationFn: ({ action, comments }: { action: MdFeasibilityAction; comments?: string }) =>
      api.mdFeasibilityAction(token!, id, action, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      queryClient.invalidateQueries({ queryKey: ['tender', id] });
    },
  });

  const report = data?.data?.report;
  const enterprise = (data?.data as { enterprise?: EnterpriseFeasibilityReport })?.enterprise;
  const pdfUrl = data?.data?.pdfUrl;

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
        pageTitle="Feasibility Report"
        pageDescription="Executive feasibility analysis and MD decision workflow."
      />

      {isLoading && <LoadingState message="Loading feasibility report…" />}

      {error && !isLoading && (
        <ErrorState error={error} onRetry={() => refetch()} title="Report not available" />
      )}

      {enterprise && (
        <EnterpriseFeasibilityReportView
          enterprise={enterprise}
          pdfUrl={pdfUrl}
          userRole={user?.role}
          onMdAction={
            user?.role === 'md'
              ? (action, comments) => mdActionMutation.mutate({ action, comments })
              : undefined
          }
        />
      )}

      {report && !enterprise && !isLoading && (
        <FeasibilityReportView
          report={report}
          pdfUrl={pdfUrl}
          tenderName={data?.data?.tender?.title}
        />
      )}
    </DashboardLayout>
  );
}
