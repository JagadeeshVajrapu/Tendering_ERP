'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchPreparationPdfBlob } from '@/lib/documentPreparationApi';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface Props {
  token: string;
  tenderId: string;
  documentId: string | null;
  documentName?: string;
}

export default function PdfViewerClient({ token, tenderId, documentId, documentName }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const blobUrlRef = useRef<string | null>(null);

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setError('');
      revokeBlob();
      setBlobUrl(null);
      setNumPages(0);
      setPage(1);

      if (!documentId) return;

      setLoading(true);
      try {
        const blob = await fetchPreparationPdfBlob(token, tenderId, documentId);
        if (!active) return;
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        setBlobUrl(objectUrl);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
      revokeBlob();
    };
  }, [token, tenderId, documentId, revokeBlob]);

  if (!documentId) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-muted-foreground">
        Select a document to preview
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <p className="truncate text-sm font-medium text-slate-800">{documentName || 'PDF Preview'}</p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.1).toFixed(2)))}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setScale((s) => Math.min(2.5, +(s + 0.1).toFixed(2)))}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {numPages ? `${page} / ${numPages}` : '—'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!numPages || page >= numPages}
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-auto bg-slate-100 p-4">
        {loading && (
          <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading PDF…
          </div>
        )}
        {error && <p className="py-20 text-sm text-red-600">{error}</p>}
        {!loading && !error && blobUrl && (
          <Document
            file={blobUrl}
            onLoadSuccess={({ numPages: total }) => setNumPages(total)}
            loading={
              <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Rendering…
              </div>
            }
            error={<p className="text-sm text-red-600">Could not render PDF</p>}
          >
            <Page pageNumber={page} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} />
          </Document>
        )}
      </div>
    </div>
  );
}
