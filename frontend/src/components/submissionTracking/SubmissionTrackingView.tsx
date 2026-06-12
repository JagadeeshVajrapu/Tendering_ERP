'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ImagePlus,
  Loader2,
  Lock,
  Send,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessage';
import type { SubmissionTrackingDashboard, SubmissionTrackingStatus } from '@/types/submissionTracking';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api').replace(
  /\/api\/?$/,
  ''
);

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface Props {
  token: string;
  tenderId: string;
  canEdit: boolean;
}

export function SubmissionTrackingView({ token, tenderId, canEdit }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['submission-tracking', tenderId],
    queryFn: () => api.getSubmissionTrackingDashboard(token, tenderId),
    enabled: !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: timelineRes } = useQuery({
    queryKey: ['submission-timeline', tenderId],
    queryFn: () => api.getSubmissionTimeline(token, tenderId),
    enabled: !!token,
  });

  const dashboard: SubmissionTrackingDashboard | null = data?.data ?? null;
  const timeline = timelineRes?.data ?? [];

  const invalidate = (refreshTender = false) => {
    void queryClient.invalidateQueries({ queryKey: ['submission-tracking', tenderId] });
    void queryClient.invalidateQueries({ queryKey: ['submission-timeline', tenderId] });
    if (refreshTender) {
      void queryClient.invalidateQueries({ queryKey: ['tender', tenderId] });
      void queryClient.invalidateQueries({ queryKey: ['tenders'] });
    }
  };

  const applySubmittedCache = () => {
    queryClient.setQueryData(['submission-tracking', tenderId], (old: { data?: SubmissionTrackingDashboard } | undefined) => {
      if (!old?.data) return old;
      return {
        ...old,
        data: {
          ...old.data,
          submissionStatus: 'submitted' as SubmissionTrackingStatus,
          readinessLabel: 'Submitted to portal',
          tenderStatus: 'SUBMITTED',
          locked: true,
        },
      };
    });
    queryClient.setQueryData(['tender', tenderId], (old: { data?: { status?: string; currentStage?: string } } | undefined) => {
      if (!old?.data) return old;
      return {
        ...old,
        data: { ...old.data, status: 'SUBMITTED', currentStage: 'Submitted' },
      };
    });
  };

  const onSuccess = (msg: string) => {
    setError('');
    setMessage(msg);
    invalidate();
    void refetch();
  };

  const readyMutation = useMutation({
    mutationFn: () => api.markSubmissionReady(token, tenderId),
    onSuccess: () => onSuccess('Marked ready for submission'),
    onError: (err) => setError(getErrorMessage(err, 'Failed to mark ready')),
  });

  const lockMutation = useMutation({
    mutationFn: () => api.lockSubmission(token, tenderId),
    onSuccess: () => onSuccess('Submission verified and locked'),
    onError: (err) => setError(getErrorMessage(err, 'Failed to lock submission')),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.markSubmissionSubmitted(token, tenderId, notes.trim() || undefined),
    onSuccess: () => {
      setError('');
      setMessage('Tender marked as submitted');
      applySubmittedCache();
      invalidate(true);
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, 'Failed to mark submitted')),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadSubmissionScreenshot(token, tenderId, file, caption.trim() || undefined),
    onSuccess: () => {
      setCaption('');
      onSuccess('Submission proof uploaded');
    },
    onError: (err) => setError(getErrorMessage(err, 'Upload failed')),
  });

  const busy =
    readyMutation.isPending ||
    lockMutation.isPending ||
    submitMutation.isPending ||
    uploadMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-20 text-muted-foreground">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-600" />
        Loading submission tracking…
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        Unable to load submission tracking data.
      </div>
    );
  }

  const urgent =
    dashboard.deadline.alertLevel === 'expired' ||
    dashboard.deadline.alertLevel === '1_hour' ||
    dashboard.deadline.alertLevel === '6_hours';

  return (
    <div className="space-y-6">
      {dashboard.locked && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Submission package locked</p>
            <p className="text-xs text-amber-800/90">
              Document modifications and deletions are disabled. BOQ changes are blocked when submission is locked.
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Completion</p>
          <p className="mt-2 text-3xl font-bold text-blue-900">{dashboard.completionPercentage}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(100, dashboard.completionPercentage)}%` }}
            />
          </div>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${urgent ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            Time remaining
          </p>
          <p className={`mt-2 text-lg font-bold ${urgent ? 'text-red-800' : 'text-slate-900'}`}>
            {dashboard.deadline.remainingLabel || 'Deadline not set'}
          </p>
          {dashboard.deadline.deadlineLabel && (
            <p className="mt-1 text-xs text-muted-foreground">Due: {dashboard.deadline.deadlineLabel}</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Submission proof</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{dashboard.screenshots.length}</p>
          <p className="text-xs text-muted-foreground">screenshot(s) uploaded</p>
        </div>
      </div>

      {dashboard.activeAlerts.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-orange-900">
            <AlertTriangle className="h-4 w-4" />
            Deadline alerts
          </p>
          <ul className="space-y-1 text-sm text-orange-800">
            {dashboard.activeAlerts.map((a) => (
              <li key={a.level}>• {a.message}</li>
            ))}
          </ul>
        </div>
      )}

      {canEdit && !dashboard.locked && dashboard.submissionStatus !== 'submitted' && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || dashboard.submissionStatus !== 'draft'}
            onClick={() => readyMutation.mutate()}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Mark ready for submission
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !dashboard.canLock}
            onClick={() => lockMutation.mutate()}
          >
            <Lock className="mr-2 h-4 w-4" />
            Verify &amp; lock submission
          </Button>
          {dashboard.lockReasons.length > 0 && dashboard.submissionStatus !== 'locked' && (
            <p className="w-full text-xs text-muted-foreground">
              Lock blocked: {dashboard.lockReasons.join(' · ')}
            </p>
          )}
        </div>
      )}

      {canEdit && dashboard.canSubmit && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="mb-2 text-sm font-medium text-emerald-900">Confirm portal submission</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1">
              <Input
                placeholder="Optional submission notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button type="button" disabled={busy || dashboard.screenshots.length === 0} onClick={() => submitMutation.mutate()}>
              <Send className="mr-2 h-4 w-4" />
              Mark as submitted
            </Button>
          </div>
          {dashboard.screenshots.length === 0 && (
            <p className="mt-2 text-xs text-amber-700">Upload at least one submission proof screenshot first.</p>
          )}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Required documents</h3>
            <Link href={`/tenders/${tenderId}/checklist`} className="text-xs text-blue-700 hover:underline">
              Manage in compliance checklist
            </Link>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {dashboard.checklistSummary.completed} of {dashboard.checklistSummary.required} mandatory documents
            complete
            {dashboard.checklistSummary.criticalMissing > 0 &&
              ` · ${dashboard.checklistSummary.criticalMissing} critical pending`}
          </p>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-2">Document</th>
                  <th className="py-2 pr-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.checklistItems.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-sm text-muted-foreground">
                      No mandatory documents identified yet. Complete NIT analysis to generate requirements.
                    </td>
                  </tr>
                ) : (
                  dashboard.checklistItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-slate-800">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.categoryTitle}</p>
                    </td>
                    <td className="py-2">
                      {item.uploaded || !item.missing ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {item.status}
                        </span>
                      ) : (
                        <span className="text-xs text-red-600">Missing</span>
                      )}
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Document package</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Preparation docs</dt>
                <dd className="font-medium">{dashboard.documents.preparationDocumentCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Total size</dt>
                <dd className="font-medium">{formatBytes(dashboard.documents.preparationTotalSize)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Valid</dt>
                <dd className="font-medium text-emerald-700">{dashboard.documents.validationComplete}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Warnings / errors</dt>
                <dd className="font-medium">
                  {dashboard.documents.validationWarning} / {dashboard.documents.validationError}
                </dd>
              </div>
            </dl>
            <Link href={`/tenders/${tenderId}/document-preparation`}>
              <Button type="button" variant="outline" size="sm" className="mt-3">
                Open document preparation
              </Button>
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ImagePlus className="h-4 w-4" />
              Submission proof screenshots
            </h3>
            {canEdit && dashboard.submissionStatus !== 'submitted' && (
              <div className="mb-4 space-y-2">
                <Input
                  placeholder="Caption (optional)"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadMutation.mutate(file);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || uploadMutation.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload screenshot
                </Button>
              </div>
            )}
            {dashboard.screenshots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submission proof uploaded yet.</p>
            ) : (
              <ul className="space-y-2">
                {dashboard.screenshots.map((shot) => (
                  <li key={shot.id} className="rounded-md border border-slate-100 p-2 text-sm">
                    <p className="font-medium text-slate-800">{shot.originalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {shot.uploadedBy.name} · {new Date(shot.uploadedAt).toLocaleString()}
                    </p>
                    {shot.caption && <p className="text-xs text-slate-600">{shot.caption}</p>}
                    <button
                      type="button"
                      className="text-xs text-blue-700 hover:underline"
                      onClick={async () => {
                        try {
                          const res = await fetch(`${API_ORIGIN}${shot.previewUrl}`, {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (!res.ok) throw new Error('Failed to load proof');
                          const blob = await res.blob();
                          window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
                        } catch {
                          setError('Could not open submission proof');
                        }
                      }}
                    >
                      View proof
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Activity timeline</h3>
          <Button type="button" variant="ghost" size="sm" disabled={isFetching} onClick={() => refetch()}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submission activity recorded yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-slate-200 pl-4">
            {timeline.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-600" />
                <p className="text-sm font-medium text-slate-900">{entry.message}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.userName} ({entry.userRole}) · {new Date(entry.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
