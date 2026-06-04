'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LabelValuePairsPanel } from '@/components/debug/LabelValuePairsPanel';
import { LabelValueMappingsPanel } from '@/components/debug/LabelValueMappingsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errorMessage';
import { ArrowLeft, Loader2, ListTree, RefreshCw } from 'lucide-react';

function LabelValuesDebugContent() {
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
    queryKey: ['label-values', activeDocumentId, refresh],
    queryFn: () => api.getLabelValuePairs(token!, activeDocumentId, refresh),
    enabled: !!token && !!activeDocumentId.trim(),
    retry: 1,
  });

  const mappingQuery = useQuery({
    queryKey: ['label-mappings', activeDocumentId, refresh],
    queryFn: () => api.getLabelValueMappings(token!, activeDocumentId, refresh),
    enabled: !!token && !!activeDocumentId.trim() && isSuccess,
    retry: 1,
  });

  const payload = isSuccess && data?.data ? data.data : null;
  const mappingPayload = mappingQuery.data?.data ?? null;

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
          <ListTree className="h-7 w-7 text-teal-700" />
          Label–Value Extractor
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every <strong>Label : Value</strong> pair found in OCR (all pages). No predefined schema.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link
            href={activeDocumentId ? `/debug/fields?documentId=${activeDocumentId}` : '/debug/fields'}
            className="text-violet-700 hover:underline"
          >
            Field Locator
          </Link>
          <Link
            href={activeDocumentId ? `/debug/pages?documentId=${activeDocumentId}` : '/debug/pages'}
            className="text-cyan-700 hover:underline"
          >
            OCR pages
          </Link>
        </div>
      </div>

      <div className="mb-8 flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="documentId">Document ID</Label>
          <Input
            id="documentId"
            value={documentIdInput}
            onChange={(e) => setDocumentIdInput(e.target.value)}
            placeholder="MongoDB document _id"
          />
        </div>
        <Button onClick={load} disabled={!documentIdInput.trim()}>
          Extract pairs
        </Button>
        {activeDocumentId && (
          <Button
            variant="outline"
            onClick={() => {
              setRefresh(true);
              refetch();
            }}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Re-scan
          </Button>
        )}
      </div>

      {!activeDocumentId && (
        <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          Enter a document ID and click Extract pairs.
        </div>
      )}

      {isLoading && activeDocumentId && (
        <div className="flex flex-col items-center py-20 text-muted-foreground">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-teal-600" />
          Scanning all pages for label–value pairs…
        </div>
      )}

      {error && activeDocumentId && !isLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {getErrorMessage(error, 'Failed to extract label–value pairs')}
        </div>
      )}

      {payload && (
        <>
          {mappingPayload && (
            <div className="mb-10">
              <LabelValueMappingsPanel data={mappingPayload} />
            </div>
          )}
          <LabelValuePairsPanel data={payload} />
        </>
      )}
    </DashboardLayout>
  );
}

export default function LabelValuesDebugPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <LabelValuesDebugContent />
    </Suspense>
  );
}
