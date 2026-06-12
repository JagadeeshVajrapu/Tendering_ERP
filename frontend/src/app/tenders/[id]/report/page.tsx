'use client';

import { use } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EnterpriseFeasibilityReportView } from '@/components/tender/feasibility/EnterpriseFeasibilityReportView';
import { FeasibilityReportView } from '@/components/tender/FeasibilityReportView';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getRoleDashboardPath } from '@/lib/roles';
import { getErrorMessage } from '@/lib/errorMessage';
import type { EnterpriseFeasibilityReport, MdFeasibilityAction } from '@/types/enterpriseFeasibilityReport';

export default function FeasibilityReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();

  const backHref = user?.role === 'executive' ? `/tenders/${id}` : getRoleDashboardPath(user?.role || 'executive');
  const backLabel = user?.role === 'executive' ? 'Back to Tender' : 'Back to Dashboard';

  const { data, isLoading, error } = useQuery({
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
      <div className="mb-6">
        <Link href={backHref}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> {backLabel}
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">{getErrorMessage(error)}</p>
          <Link href={backHref}>
            <Button className="mt-4" variant="outline">{backLabel}</Button>
          </Link>
        </div>
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

      {report && !enterprise && (
        <FeasibilityReportView
          report={report}
          pdfUrl={pdfUrl}
          tenderName={data?.data?.tender?.title}
        />
      )}
    </DashboardLayout>
  );
}
