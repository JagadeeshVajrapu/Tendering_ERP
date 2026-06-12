'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { TenderIntelligence } from '@/types';
import { Loader2, FileSearch } from 'lucide-react';
import Link from 'next/link';
import { NitAnalysisTables } from './NitAnalysisTables';

function useSmoothJobProgress(job: {
  status: string;
  progress: number;
}): number {
  const [displayProgress, setDisplayProgress] = useState(job.progress);

  useEffect(() => {
    setDisplayProgress((prev) => Math.max(prev, job.progress));
  }, [job.progress]);

  useEffect(() => {
    if (job.status === 'completed' || job.status === 'failed') {
      setDisplayProgress(job.progress);
      return;
    }

    const capByStatus: Record<string, number> = {
      queued: 8,
      extracting_pages: 18,
      chunking: 28,
      analyzing: 94,
      merging: 97,
      validating: 98,
      generating_report: 99,
    };
    const statusCap = capByStatus[job.status] ?? 95;
    const cap = Math.min(99, Math.max(statusCap, job.progress + 8));

    const timer = window.setInterval(() => {
      setDisplayProgress((prev) => {
        const floor = Math.max(prev, job.progress);
        if (floor >= cap) return floor;
        const step = job.status === 'analyzing' ? 2 : 1;
        return Math.min(cap, floor + step);
      });
    }, 1500);

    return () => window.clearInterval(timer);
  }, [job.progress, job.status]);

  return displayProgress;
}

interface Props {
  intelligence: TenderIntelligence;
  tenderTitle?: string;
}

export function IntelligenceDashboard({ intelligence, tenderTitle }: Props) {
  return <NitAnalysisTables intelligence={intelligence} tenderTitle={tenderTitle} />;
}

export function IntelligenceJobProgress({
  job,
  uploadSuccess,
  compact,
  documentId,
}: {
  job: { status: string; progress: number; pageCount?: number; chunkCount?: number; errorMessage?: string };
  uploadSuccess?: boolean;
  compact?: boolean;
  documentId?: string | null;
}) {
  const statusLabels: Record<string, string> = {
    queued: 'Queued for processing',
    extracting_pages: 'OCR — reading document pages',
    chunking: 'Processing document sections',
    analyzing: 'Extracting & validating tender parameters',
    merging: 'Building master dataset',
    validating: 'Requirement discovery & validation',
    generating_report: 'NIT Analysis & checklist',
    completed: 'Analysis complete',
    failed: 'Analysis failed',
  };

  const isComplete = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const displayProgress = useSmoothJobProgress(job);

  const analyzingDetail =
    job.status === 'analyzing' && job.progress < 54
      ? 'AI extraction in progress…'
      : job.status === 'analyzing' && job.progress < 68
        ? 'Ranking & validation…'
        : job.status === 'analyzing'
          ? 'Preparing master dataset…'
          : job.status === 'merging'
            ? 'Building NIT parameter table…'
            : job.status === 'generating_report'
              ? 'Finalizing checklist & report…'
              : null;

  if (compact) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-700">
            {!isComplete && !isFailed && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />}
            {statusLabels[job.status] || job.status}
          </span>
          <span className="font-semibold">{displayProgress}%</span>
        </div>
        <Progress value={displayProgress} className="h-1.5" />
        {analyzingDetail && (
          <p className="text-xs text-slate-500">{analyzingDetail}</p>
        )}
      </div>
    );
  }

  return (
    <Card className={isFailed ? 'border-red-200' : 'border-blue-200'}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {!isComplete && !isFailed && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
          Tender Intelligence Engine
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {uploadSuccess && (
          <p className="text-sm font-medium text-emerald-700">Document uploaded successfully.</p>
        )}
        {!isComplete && !isFailed && (
          <p className="text-sm text-slate-700">Analyzing Tender Document...</p>
        )}
        <div className="flex items-center justify-between text-sm">
          <span>{statusLabels[job.status] || job.status}</span>
          <span className="font-semibold">{displayProgress}%</span>
        </div>
        <Progress value={displayProgress} className="h-2" />
        {analyzingDetail && (
          <p className="text-xs text-slate-500">{analyzingDetail}</p>
        )}
        {job.pageCount ? (
          <p className="text-xs text-muted-foreground">
            {job.pageCount} pages · {job.chunkCount || 0} chunks
          </p>
        ) : null}
        {documentId && (job.progress >= 8 || job.pageCount) && (
          <Link
            href={`/debug/pages?documentId=${documentId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700 hover:text-cyan-900"
          >
            <FileSearch className="h-4 w-4" />
            Verify OCR text per page
          </Link>
        )}
        {!isComplete && !isFailed && (
          <p className="text-xs text-slate-500">
            Verified NIT parameters appear in the table below as extraction completes.
          </p>
        )}
        {job.errorMessage && <p className="text-sm text-red-600">{job.errorMessage}</p>}
      </CardContent>
    </Card>
  );
}
