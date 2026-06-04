'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ParameterMappingsPanel } from '@/components/debug/ParameterMappingsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errorMessage';
import { ArrowLeft, Loader2, RefreshCw, GitMerge } from 'lucide-react';

function ParameterMappingsDebugContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('documentId') || '';
  const { token } = useAuthStore();
  const [documentIdInput, setDocumentIdInput] = useState(initialId);
  const [activeDocumentId, setActiveDocumentId] = useState(initialId);
  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    if (initialId) {
      setDocumentIdInput(initialId);
      setActiveDocumentId(initialId);
    }
  }, [initialId]);

  const { data, isLoading, isFetching, error, refetch, isSuccess } = useQuery({
    queryKey: ['parameter-mappings', activeDocumentId, refresh],
    queryFn: () => api.getParameterMappings(token!, activeDocumentId, refresh),
    enabled: !!token && !!activeDocumentId.trim(),
    retry: 1,
  });

  const payload = isSuccess && data?.data ? data.data : null;

  const load = () => {
    const id = documentIdInput.trim();
    if (!id) return;
    setRefresh(false);
    setActiveDocumentId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('documentId', id);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link
          href="/tenders"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tenders
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GitMerge className="h-7 w-7 text-indigo-700" />
          Parameter Mapping Engine
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Maps discovered parameters to master fields — e.g. Tender No, Bid Reference Number →
          Tender Number; EM, EMD → EMD Amount.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link
            href={
              activeDocumentId
                ? `/debug/discovered-parameters?documentId=${activeDocumentId}`
                : '/debug/discovered-parameters'
            }
            className="text-violet-700 hover:underline"
          >
            Discovered parameters
          </Link>
          <Link
            href={
              activeDocumentId
                ? `/debug/ocr-normalization?documentId=${activeDocumentId}`
                : '/debug/ocr-normalization'
            }
            className="text-teal-700 hover:underline"
          >
            OCR normalization
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[280px] flex-1">
          <Label htmlFor="documentId">Document ID</Label>
          <Input
            id="documentId"
            value={documentIdInput}
            onChange={(e) => setDocumentIdInput(e.target.value)}
            className="mt-1 font-mono text-sm"
          />
        </div>
        <Button onClick={load}>Load</Button>
        <Button
          variant="outline"
          disabled={!activeDocumentId || isFetching}
          onClick={() => {
            setRefresh(true);
            refetch();
          }}
        >
          {isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      )}

      {error && !isLoading && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {getErrorMessage(error, 'Mapping failed')}
        </p>
      )}

      {payload && <ParameterMappingsPanel data={payload} />}
    </DashboardLayout>
  );
}

export default function ParameterMappingsDebugPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        </DashboardLayout>
      }
    >
      <ParameterMappingsDebugContent />
    </Suspense>
  );
}
