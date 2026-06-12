'use client';

import Link from 'next/link';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TenderModuleNav } from '@/components/tender/TenderModuleNav';
import { TenderStatusBadge } from '@/components/tender/TenderStatusBadge';
import { resolveEffectiveTenderStatus } from '@/lib/tenderStatus';
import type { UserRole } from '@/types';
import type { SubmissionTrackingStatus } from '@/types/submissionTracking';

interface Props {
  tenderId: string;
  title?: string;
  status?: string;
  currentStage?: string;
  submissionStatus?: SubmissionTrackingStatus;
  userRole?: UserRole;
  analysisComplete?: boolean;
  hasReport?: boolean;
  showBack?: boolean;
  pageTitle?: string;
  pageDescription?: string;
  onReanalyze?: () => void;
  reanalyzePending?: boolean;
  reanalyzeDisabled?: boolean;
}

export function TenderPageHeader({
  tenderId,
  title,
  status,
  currentStage,
  submissionStatus,
  userRole,
  analysisComplete,
  hasReport,
  showBack = false,
  pageTitle,
  pageDescription,
  onReanalyze,
  reanalyzePending,
  reanalyzeDisabled,
}: Props) {
  const displayTitle = pageTitle || title || 'Tender';
  const displayStatus = resolveEffectiveTenderStatus(status, { submissionStatus }) || status;
  const displayStage =
    displayStatus === 'SUBMITTED'
      ? 'Submitted'
      : displayStatus === 'AWARDED'
        ? 'Awarded'
        : currentStage;

  return (
    <div className="mb-6 space-y-4">
      {showBack && (
        <Link
          href={`/tenders/${tenderId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </Link>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{displayTitle}</h1>
            {!pageTitle && title && pageTitle !== title && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{title}</p>
            )}
            {pageDescription && (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{pageDescription}</p>
            )}
            {(status || currentStage) && (
              <div className="mt-3">
                <TenderStatusBadge
                  status={displayStatus}
                  currentStage={displayStage}
                  submissionStatus={submissionStatus}
                />
              </div>
            )}
          </div>

          {onReanalyze && analysisComplete && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={onReanalyze}
              disabled={reanalyzePending || reanalyzeDisabled}
            >
              {reanalyzePending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Re-analyze
            </Button>
          )}
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <TenderModuleNav
            tenderId={tenderId}
            userRole={userRole}
            tenderStatus={displayStatus}
            analysisComplete={analysisComplete}
            hasReport={hasReport}
          />
        </div>
      </div>
    </div>
  );
}
