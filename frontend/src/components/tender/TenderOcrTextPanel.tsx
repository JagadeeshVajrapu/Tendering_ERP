'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessage';
import { ChevronDown, ChevronUp, ExternalLink, FileSearch, Loader2, Search } from 'lucide-react';

interface Props {
  documentId: string;
  token: string;
  embedded?: boolean;
  defaultExpanded?: boolean;
  jobRunning?: boolean;
}

function OcrPageList({
  pages,
  filtered,
  search,
  onSearch,
  embedded,
  documentId,
}: {
  pages: Array<{ pageNumber: number; characterCount?: number; extractedText?: string }>;
  filtered: typeof pages;
  search: string;
  onSearch: (v: string) => void;
  embedded?: boolean;
  documentId: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search page or text…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {pages.length} pages
        </span>
        {embedded && (
          <Link
            href={`/debug/pages?documentId=${documentId}`}
            className="text-xs font-medium text-cyan-700 hover:underline"
          >
            Full OCR view
          </Link>
        )}
      </div>

      <div className={`space-y-2 overflow-auto pr-1 ${embedded ? 'max-h-[45vh]' : 'max-h-[60vh]'}`}>
        {filtered.map((page) => (
          <div
            key={page.pageNumber}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50 px-3 py-1.5">
              <span className="text-xs font-semibold text-slate-800">Page {page.pageNumber}</span>
              <Badge variant="outline" className="tabular-nums text-xs">
                {(page.characterCount ?? 0).toLocaleString()} chars
              </Badge>
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words p-2.5 font-mono text-xs leading-relaxed text-slate-800">
              {(page.extractedText ?? '').trim() || '(No text on this page)'}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TenderOcrTextPanel({
  documentId,
  token,
  embedded = false,
  defaultExpanded = false,
  jobRunning = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded || embedded);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (embedded && documentId) setExpanded(true);
  }, [embedded, documentId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['ocr-pages-inline', documentId],
    queryFn: () => api.getDebugDocumentPages(token, documentId),
    enabled: !!token && !!documentId && expanded,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const pageCount = query.state.data?.data?.pages?.length ?? 0;
      if (jobRunning && pageCount === 0) return 3000;
      return false;
    },
  });

  const pages = data?.data?.pages ?? [];
  const q = search.trim().toLowerCase();
  const filtered = !q
    ? pages
    : pages.filter(
        (p) =>
          String(p.pageNumber).includes(q) ||
          (p.extractedText ?? '').toLowerCase().includes(q)
      );

  const content = expanded ? (
    <>
      {isLoading && (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
          {jobRunning ? 'OCR processing… pages will appear here' : 'Loading OCR pages…'}
        </div>
      )}
      {error && (
        <p className="py-4 text-sm text-muted-foreground">
          {getErrorMessage(error, 'OCR text not available yet')}
        </p>
      )}
      {!isLoading && !error && pages.length > 0 && (
        <OcrPageList
          pages={pages}
          filtered={filtered}
          search={search}
          onSearch={setSearch}
          embedded={embedded}
          documentId={documentId}
        />
      )}
      {!isLoading && !error && pages.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          {jobRunning ? 'OCR is running — text will show here page by page.' : 'No OCR pages yet.'}
        </p>
      )}
    </>
  ) : null;

  if (embedded) {
    return (
      <div className="mt-4 rounded-lg border border-cyan-200/80 bg-cyan-50/30 p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <FileSearch className="h-4 w-4 text-cyan-700" />
          OCR Text
        </p>
        {content}
      </div>
    );
  }

  return (
    <Card className="mt-6 border-cyan-200/80 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 border-b bg-cyan-50/40 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
            <FileSearch className="h-5 w-5 text-cyan-700" />
            OCR Text
          </CardTitle>
        </div>
        <div className="flex gap-2">
          <Link href={`/debug/pages?documentId=${documentId}`}>
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Full view
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && <CardContent>{content}</CardContent>}
    </Card>
  );
}
