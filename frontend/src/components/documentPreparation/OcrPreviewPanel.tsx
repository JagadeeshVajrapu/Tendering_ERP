'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileSearch, Loader2, ScanText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessage';
import type { PreparationOcrResult } from '@/types/documentPreparation';

interface Props {
  token: string;
  tenderId: string;
  documentId: string | null;
  documentName?: string;
  canEdit: boolean;
}

export function OcrPreviewPanel({ token, tenderId, documentId, documentName, canEdit }: Props) {
  const [selectedPage, setSelectedPage] = useState(1);
  const [localError, setLocalError] = useState('');

  const { data: ocrResponse, refetch, isFetching } = useQuery({
    queryKey: ['preparation-ocr', tenderId, documentId],
    queryFn: () => api.getPreparationDocumentOcr(token, tenderId, documentId!),
    enabled: !!token && !!documentId,
    retry: false,
  });

  const ocr = ocrResponse?.data ?? null;

  useEffect(() => {
    setSelectedPage(1);
    setLocalError('');
  }, [documentId]);

  const runOcrMutation = useMutation({
    mutationFn: () => {
      if (!documentId) throw new Error('Select a document first');
      return api.runPreparationDocumentOcr(token, tenderId, documentId);
    },
    onSuccess: () => {
      setLocalError('');
      void refetch();
    },
    onError: (err) => setLocalError(getErrorMessage(err, 'OCR failed')),
  });

  const activePage = ocr?.pages.find((p) => p.pageNumber === selectedPage);

  if (!documentId) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-muted-foreground">
        Select a document to run OCR or view extracted text.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ScanText className="h-4 w-4" />
            OCR Engine
          </h3>
          <p className="text-xs text-muted-foreground">
            Extract text from scanned or digital PDFs — {documentName}
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            disabled={runOcrMutation.isPending}
            onClick={() => runOcrMutation.mutate()}
          >
            {runOcrMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSearch className="mr-2 h-4 w-4" />
            )}
            Run OCR
          </Button>
        )}
      </div>

      {localError && <p className="text-sm text-red-600">{localError}</p>}

      {isFetching && !ocr && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading OCR result…
        </div>
      )}

      {!ocr && !isFetching && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-muted-foreground">
          No OCR result yet. Click <strong>Run OCR</strong> to extract text from this PDF.
        </p>
      )}

      {ocr && (
        <>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="rounded-full bg-slate-100 px-2 py-1">Status: {ocr.status}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1">Method: {ocr.method}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1">Quality: {ocr.qualityScore}%</span>
            <span className="rounded-full bg-slate-100 px-2 py-1">
              {(ocr.processingTimeMs / 1000).toFixed(1)}s
            </span>
          </div>

          {ocr.status === 'failed' && (
            <p className="text-sm text-red-600">{ocr.errorMessage || 'OCR failed'}</p>
          )}

          {ocr.status === 'completed' && (
            <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
              <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
                {ocr.pages.map((page) => (
                  <button
                    key={page.pageNumber}
                    type="button"
                    onClick={() => setSelectedPage(page.pageNumber)}
                    className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-xs last:border-0 ${
                      selectedPage === page.pageNumber ? 'bg-blue-50 font-medium text-blue-900' : 'hover:bg-slate-50'
                    }`}
                  >
                    Page {page.pageNumber}
                    <span className="ml-1 text-muted-foreground">({page.charCount} chars)</span>
                  </button>
                ))}
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-medium text-slate-600">
                  Page {selectedPage} preview ({activePage?.method})
                </p>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-800">
                  {activePage?.text || 'No text on this page'}
                </pre>
              </div>
            </div>
          )}

          {ocr.status === 'completed' && (
            <details className="rounded-md border border-slate-200">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">
                Full document text
              </summary>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap border-t border-slate-200 p-3 text-xs text-slate-700">
                {ocr.fullText}
              </pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}
