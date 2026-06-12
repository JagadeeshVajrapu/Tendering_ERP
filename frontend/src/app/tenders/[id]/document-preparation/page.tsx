'use client';

import { use } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DocumentPreparationView } from '@/components/documentPreparation/DocumentPreparationView';
import { TenderPageHeader } from '@/components/tender/TenderPageHeader';
import { useTenderNavContext } from '@/components/tender/useTenderNavContext';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errorMessage';

export default function DocumentPreparationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();
  const { tender, analysisComplete, hasReport, submissionStatus } = useTenderNavContext(id);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['tender-document-preparation', id],
    queryFn: () => api.getPreparationDocuments(token!, id),
    enabled: !!token,
    staleTime: 10_000,
  });

  const list = data?.data;

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
        pageTitle="Document Preparation"
        pageDescription="Upload, OCR, edit, validate, sign, and auto-fill tender submission PDFs."
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
        <div className="hidden sm:block" />
        <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center py-20 text-muted-foreground">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-600" />
          Loading document repository…
        </div>
      )}

      {error && !list && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {getErrorMessage(error, 'Failed to load documents')}
        </div>
      )}

      {list && token && (
        <DocumentPreparationView
          token={token}
          tenderId={id}
          data={list}
          userRole={user?.role}
          onRefresh={async () => {
            await queryClient.invalidateQueries({ queryKey: ['tender-document-preparation', id] });
            await refetch();
          }}
        />
      )}
    </DashboardLayout>
  );
}
