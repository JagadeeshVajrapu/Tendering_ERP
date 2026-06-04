'use client';

import { useState } from 'react';
import type { ElementType } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OcrDebugPagesResponse } from '@/types/ocrDebug';
import {
  Search,
  Copy,
  Check,
  FileText,
  Clock,
  Gauge,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  data: OcrDebugPagesResponse;
}

function resolveMetrics(data: OcrDebugPagesResponse) {
  const pages = data.pages ?? [];
  const stored = data.qualityMetrics;

  if (pages.length) {
    const totalCharacters = pages.reduce((sum, p) => sum + (p.characterCount ?? 0), 0);
    const pageCount = pages.length;
    const averageCharactersPerPage = Math.round(totalCharacters / pageCount);
    if (typeof stored?.qualityScore === 'number' && typeof stored?.totalCharacters === 'number') {
      return {
        pages: pageCount,
        totalCharacters: stored.totalCharacters,
        averageCharactersPerPage: stored.averageCharactersPerPage ?? averageCharactersPerPage,
        qualityScore: stored.qualityScore,
      };
    }
    const nonEmpty = pages.filter((p) => (p.characterCount ?? 0) >= 40).length;
    const coverageRatio = nonEmpty / pageCount;
    const densityRatio = Math.min(1, averageCharactersPerPage / 2000);
    const qualityScore =
      typeof stored?.qualityScore === 'number'
        ? stored.qualityScore
        : Math.round(Math.min(100, coverageRatio * 55 + densityRatio * 45));
    return { pages: pageCount, totalCharacters, averageCharactersPerPage, qualityScore };
  }

  if (
    stored &&
    typeof stored.totalCharacters === 'number' &&
    typeof stored.qualityScore === 'number'
  ) {
    return stored;
  }

  return {
    pages: data.pageCount || 0,
    totalCharacters: 0,
    averageCharactersPerPage: 0,
    qualityScore: typeof stored?.qualityScore === 'number' ? stored.qualityScore : 0,
  };
}

export function OcrDebugViewer({ data }: Props) {
  const [search, setSearch] = useState('');
  const [copiedPage, setCopiedPage] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const pages = data.pages ?? [];
  const metrics = resolveMetrics({ ...data, pages });
  const qualityThreshold = data.qualityThreshold ?? 70;
  const passesQualityGate =
    typeof data.passesQualityGate === 'boolean'
      ? data.passesQualityGate
      : metrics.qualityScore >= qualityThreshold;

  const q = search.trim().toLowerCase();
  const filteredPages = !q
    ? pages
    : pages.filter(
        (p) =>
          String(p.pageNumber).includes(q) ||
          (p.extractedText ?? '').toLowerCase().includes(q) ||
          (p.extractionMethod ?? '').toLowerCase().includes(q)
      );

  const copyText = async (text: string, pageNumber?: number) => {
    await navigator.clipboard.writeText(text);
    if (pageNumber !== undefined) {
      setCopiedPage(pageNumber);
      setTimeout(() => setCopiedPage(null), 2000);
    } else {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const copyAllPages = () => {
    const blob = pages
      .map(
        (p) =>
          `=== Page ${p.pageNumber} (${p.characterCount} chars, ${p.extractionMethod}) ===\n${p.extractedText}`
      )
      .join('\n\n');
    void copyText(blob);
  };

  const formatMs = (ms: number | null) => {
    if (ms === null) return '—';
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-700">
              OCR Debug Viewer
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Verify extracted text per page</h1>
            {data.originalName && (
              <p className="mt-1 text-sm text-slate-600">
                {data.originalName} · {data.mimeType}
              </p>
            )}
            <p className="mt-1 font-mono text-xs text-slate-500">Document ID: {data.documentId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyAllPages}>
              {copiedAll ? (
                <Check className="mr-2 h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copy all pages
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={FileText}
            label="Pages"
            value={String(data.pageCount ?? pages.length)}
            sub={`${metrics.totalCharacters.toLocaleString()} total characters`}
          />
          <MetricCard
            icon={Clock}
            label="Processing time"
            value={formatMs(data.processingTimeMs)}
            sub="Document OCR duration"
          />
          <MetricCard
            icon={Gauge}
            label="OCR quality score"
            value={`${metrics.qualityScore}/100`}
            sub={`Threshold: ${qualityThreshold}`}
            highlight={!passesQualityGate}
          />
          <MetricCard
            icon={passesQualityGate ? CheckCircle2 : AlertTriangle}
            label="Quality gate"
            value={passesQualityGate ? 'Pass' : 'Below threshold'}
            sub={data.detectedType ? `Type: ${data.detectedType}` : 'Review before extraction'}
            highlight={!passesQualityGate}
          />
        </div>

        {!passesQualityGate && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Quality score is below {qualityThreshold}. Review OCR text below — extraction may be
            blocked until quality improves.
          </p>
        )}
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search page number or text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          Showing {filteredPages.length} of {data.pageCount ?? pages.length} pages
        </span>
      </div>

      <div className="space-y-4">
        {filteredPages.map((page) => {
          const empty = page.characterCount < 40;
          return (
            <Card
              key={page.pageNumber}
              className={cn('overflow-hidden', empty && 'border-amber-300 bg-amber-50/30')}
            >
              <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/80 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">Page {page.pageNumber}</CardTitle>
                  <Badge variant="outline" className="tabular-nums">
                    {(page.characterCount ?? 0).toLocaleString()} chars
                  </Badge>
                  <Badge variant="secondary">{page.extractionMethod}</Badge>
                  {empty && (
                    <Badge className="bg-amber-100 text-amber-800">Low content</Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText(page.extractedText, page.pageNumber)}
                >
                  {copiedPage === page.pageNumber ? (
                    <>
                      <Check className="mr-2 h-4 w-4 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy text
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-sm leading-relaxed text-slate-800">
                  {(page.extractedText ?? '').trim() || '(No text extracted for this page)'}
                </pre>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredPages.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No pages match your search.</p>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: ElementType;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-3',
        highlight && 'border-amber-300 bg-amber-50/50'
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', highlight ? 'text-amber-600' : 'text-cyan-600')} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
