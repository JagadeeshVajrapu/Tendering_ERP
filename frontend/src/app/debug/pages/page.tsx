'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { OcrDebugViewer } from '@/components/debug/OcrDebugViewer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errorMessage';
import { ArrowLeft, Loader2, Search, FileSearch } from 'lucide-react';

function OcrDebugPagesContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('documentId') || '';
  const { token } = useAuthStore();
  const [documentIdInput, setDocumentIdInput] = useState(initialId);
  const [activeDocumentId, setActiveDocumentId] = useState(initialId);

  useEffect(() => {
    if (initialId) {
      setDocumentIdInput(initialId);
      setActiveDocumentId(initialId);
    }
  }, [initialId]);

  const { data, isLoading, isFetching, isSuccess, error, refetch } = useQuery({
    queryKey: ['ocr-debug-pages', activeDocumentId],
    queryFn: () => api.getDebugDocumentPages(token!, activeDocumentId),
    enabled: !!token && !!activeDocumentId.trim(),
    retry: 1,
  });

  const payload = isSuccess && data?.data ? data.data : null;

  const loadPages = () => {
    const id = documentIdInput.trim();
    if (!id) return;
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
          <FileSearch className="h-7 w-7 text-cyan-700" />
          OCR Debug — Pages
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read OCR output for every page before rule extraction or field detection runs.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link
            href={
              activeDocumentId
                ? `/debug/ocr-normalization?documentId=${activeDocumentId}`
                : '/debug/ocr-normalization'
            }
            className="font-medium text-teal-700 hover:underline"
          >
            OCR Normalization (Label | Value | Page)
          </Link>
          <Link
            href={activeDocumentId ? `/debug/fields?documentId=${activeDocumentId}` : '/debug/fields'}
            className="text-violet-700 hover:underline"
          >
            Field Locator
          </Link>
        </div>
      </div>

      <div className="mb-8 flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="documentId">Document ID</Label>
          <Input
            id="documentId"
            placeholder="Paste tender document MongoDB _id"
            value={documentIdInput}
            onChange={(e) => setDocumentIdInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadPages()}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Find this on the tender upload response, MongoDB TenderDocument, or network tab after upload.
          </p>
        </div>
        <Button onClick={loadPages} disabled={!documentIdInput.trim()}>
          <Search className="mr-2 h-4 w-4" />
          Load OCR pages
        </Button>
        {activeDocumentId && (
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        )}
      </div>

      {!activeDocumentId && (
        <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          Enter a document ID and click Load OCR pages.
        </div>
      )}

      {isLoading && activeDocumentId && (
        <div className="flex flex-col items-center py-20 text-muted-foreground">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-cyan-600" />
          Loading OCR pages...
        </div>
      )}

      {error && activeDocumentId && !isLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {getErrorMessage(error, 'Failed to load OCR pages')}
        </div>
      )}

      {payload && (
        <OcrDebugViewer key={activeDocumentId} data={payload} />
      )}
    </DashboardLayout>
  );
}

export default function OcrDebugPagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
        </div>
      }
    >
      <OcrDebugPagesContent />
    </Suspense>
  );
}
