'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FolderOpen, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DocumentPreparationView } from '@/components/documentPreparation/DocumentPreparationView';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errorMessage';

export default function DocumentPreparationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['tender-document-preparation', id],
    queryFn: () => api.getPreparationDocuments(token!, id),
    enabled: !!token,
    staleTime: 10_000,
  });

  const list = data?.data;

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
            <FolderOpen className="h-6 w-6 text-blue-700" />
            Document Preparation
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Upload, OCR, edit, validate, sign, and auto-fill tender submission PDFs. Phase 4 adds
            advanced editing, e-sign workflows, Class 3 DSC integration, and audit trails.
          </p>
        </div>
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
