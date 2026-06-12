'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EnterpriseDynamicParameterExtractionPanel } from '@/components/debug/EnterpriseDynamicParameterExtractionPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errorMessage';
import { ArrowLeft, Loader2, RefreshCw, Sparkles } from 'lucide-react';

function DynamicParameterExtractionContent() {
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

  const { data, isLoading, isFetching, isSuccess, error, refetch } = useQuery({
    queryKey: ['dynamic-parameter-extraction', activeDocumentId, refresh],
    queryFn: () => api.getDynamicParameterExtraction(token!, activeDocumentId, refresh),
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
        <Link href="/tenders" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to tenders
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-7 w-7 text-amber-700" />
          Enterprise Dynamic Parameter Extraction
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Section-aware extraction of known and unknown tender parameters from OCR. Uses tender type and section context.
        </p>
      </div>

      <div className="mb-8 flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="documentId">Document ID</Label>
          <Input id="documentId" value={documentIdInput} onChange={(e) => setDocumentIdInput(e.target.value)} placeholder="MongoDB document _id" />
        </div>
        <Button onClick={load} disabled={!documentIdInput.trim()}>Extract</Button>
        {activeDocumentId && (
          <Button variant="outline" onClick={() => { setRefresh(true); refetch(); }} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Re-extract
          </Button>
        )}
      </div>

      {!activeDocumentId && (
        <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          Enter a document ID and click Extract.
        </div>
      )}

      {isLoading && activeDocumentId && (
        <div className="flex flex-col items-center py-20 text-muted-foreground">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-amber-600" />
          Running enterprise dynamic parameter extraction…
        </div>
      )}

      {error && activeDocumentId && !isLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {getErrorMessage(error, 'Failed to extract parameters')}
        </div>
      )}

      {payload && <EnterpriseDynamicParameterExtractionPanel data={payload} />}
    </DashboardLayout>
  );
}

export default function DynamicParameterExtractionPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-amber-600" /></div>}>
      <DynamicParameterExtractionContent />
    </Suspense>
  );
}
