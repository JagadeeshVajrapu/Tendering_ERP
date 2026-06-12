'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IntelligenceJobProgress } from '@/components/tender/IntelligenceDashboard';
import { NitAnalysisParametersTable } from '@/components/tender/NitAnalysisParametersTable';
import { TenderWorkflowPanel } from '@/components/tender/TenderWorkflowPanel';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { statusColor } from '@/lib/utils';
import type { IntelligenceJob } from '@/types';
import Link from 'next/link';
import {
  Upload,
  FileText,
  Send,
  IndianRupee,
  Shield,
  Loader2,
  RefreshCw,
  FileSearch,
  FolderOpen,
  ClipboardCheck,
} from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import { getErrorMessage } from '@/lib/errorMessage';

const EMPTY_JOB: IntelligenceJob = {
  _id: '',
  status: 'queued',
  progress: 0,
  pageCount: 0,
  chunkCount: 0,
  chunksProcessed: 0,
  passesCompleted: 0,
  totalChunkPasses: 0,
};

export default function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [lastDocumentId, setLastDocumentId] = useState<string | null>(null);
  const [liveJob, setLiveJob] = useState<IntelligenceJob | null>(null);

  const { data: tenderData } = useQuery({
    queryKey: ['tender', id],
    queryFn: () => api.getTender(token!, id),
    enabled: !!token,
  });

  const { data: analysisData, refetch: refetchAnalysis } = useQuery({
    queryKey: ['analysis', id],
    queryFn: () => api.getTenderAnalysis(token!, id),
    enabled: !!token,
    retry: false,
    refetchInterval: (query) => {
      const job = query.state.data?.data?.job;
      const stillRunning = job && job.status !== 'completed' && job.status !== 'failed';
      if (stillRunning) return 6000;
      return false;
    },
  });

  const refetch = useCallback(() => refetchAnalysis(), [refetchAnalysis]);

  useEffect(() => {
    if (!token) return;

    let socket: Socket | null = null;
    try {
      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5001', {
        auth: { userId: useAuthStore.getState().user?.id },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
      });

      socket.emit('join:tender', id);

      socket.on('tender:update', (payload: {
        type?: string;
        progress?: number;
        status?: string;
        errorMessage?: string;
      }) => {
        qc.invalidateQueries({ queryKey: ['tender', id] });
        if (payload?.status || payload?.progress !== undefined || payload?.errorMessage) {
          setLiveJob((prev) => ({
            ...(prev ?? EMPTY_JOB),
            status: payload.status ?? prev?.status ?? EMPTY_JOB.status,
            progress: payload.progress ?? prev?.progress ?? 0,
            errorMessage: payload.errorMessage ?? prev?.errorMessage,
          }));
        }
        if (payload?.type === 'intelligence:preview') {
          void qc.invalidateQueries({ queryKey: ['tender-nit-analysis', id] });
          void qc.invalidateQueries({ queryKey: ['tender-dynamic-checklist', id] });
          void qc.invalidateQueries({ queryKey: ['submission-tracking', id] });
        }
        if (
          payload?.type === 'intelligence:complete' ||
          payload?.type === 'intelligence:preview' ||
          payload?.status === 'completed' ||
          payload?.status === 'failed' ||
          (payload?.progress ?? 0) >= 8
        ) {
          refetch();
          void qc.invalidateQueries({ queryKey: ['tender-nit-analysis', id] });
          void qc.invalidateQueries({ queryKey: ['tender-dynamic-checklist', id] });
          void qc.invalidateQueries({ queryKey: ['submission-tracking', id] });
          void qc.invalidateQueries({ queryKey: ['ocr-pages-inline'] });
        }
      });
    } catch (err) {
      console.warn('[Socket] init failed:', getErrorMessage(err));
    }

    return () => {
      socket?.disconnect();
    };
  }, [id, token, qc, refetch]);

  const upload = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const res = await api.uploadTender(token!, file, { tenderId: id });
      const docId = res.data?.document?.id ? String(res.data.document.id) : null;
      if (docId) setLastDocumentId(docId);
      if (res.data?.job) {
        setLiveJob({ ...res.data.job, documentId: docId ?? res.data.job.documentId });
      }
      refetch();
      qc.invalidateQueries({ queryKey: ['tender', id] });
    } catch (err) {
      setUploadError(getErrorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const reanalyze = useMutation({
    mutationFn: () => api.reanalyzeTender(token!, id),
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ['tender', id] });
      qc.invalidateQueries({ queryKey: ['tender-nit-analysis', id] });
      qc.invalidateQueries({ queryKey: ['tender-dynamic-checklist', id] });
      qc.invalidateQueries({ queryKey: ['ocr-pages-inline'] });
    },
    onError: (err) => setUploadError(getErrorMessage(err, 'Re-analyze failed')),
  });

  const generateReport = useMutation({
    mutationFn: () => api.generateFeasibilityReport(token!, id),
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ['tender', id] });
      router.push(`/tenders/${id}/report`);
    },
    onError: (err) => setUploadError(getErrorMessage(err, 'Report generation failed')),
  });

  const submitMd = useMutation({
    mutationFn: () => api.submitToMd(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tender', id] }),
  });

  const financeRequest = useMutation({
    mutationFn: (type: string) => api.createFinanceRequest(token!, id, type, 100000),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tender', id] }),
  });

  const complianceRequest = useMutation({
    mutationFn: () =>
      api.createComplianceRequest(token!, id, ['ISO Certificate', 'GST Certificate', 'Experience Certificate']),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tender', id] }),
  });

  const tender = tenderData?.data;
  const intelligence = analysisData?.data?.intelligence;
  const job = liveJob || analysisData?.data?.job;
  const hasReport = !!analysisData?.data?.report;
  const jobFinished = job?.status === 'completed' || job?.status === 'failed';
  const analysisComplete = job?.status === 'completed';
  const jobRunning = !!job && !jobFinished;

  const ocrDocumentId =
    lastDocumentId || (job?.documentId ? String(job.documentId) : null) || null;

  const showAnalysisSection = !!ocrDocumentId || !!jobRunning || analysisComplete;
  const paramsReady = !!ocrDocumentId && ((job?.progress ?? 0) >= 5 || analysisComplete);

  useEffect(() => {
    const fromJob = analysisData?.data?.job?.documentId;
    if (fromJob && !lastDocumentId) setLastDocumentId(String(fromJob));
  }, [analysisData?.data?.job?.documentId, lastDocumentId]);

  useEffect(() => {
    if (analysisComplete && token) {
      void qc.invalidateQueries({ queryKey: ['tender-nit-analysis', id] });
      void qc.invalidateQueries({ queryKey: ['tender-dynamic-checklist', id] });
    }
  }, [analysisComplete, token, id, qc]);

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{tender?.title}</h1>
          <span
            className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${statusColor(tender?.status || '')}`}
          >
            {tender?.currentStage}
          </span>
        </div>

        <div className="flex max-w-xl flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            {user?.role === 'executive' && (
              <Link href={`/tenders/${id}/submission-tracking`}>
                <Button className="bg-blue-700 hover:bg-blue-800">
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Submission Tracking
                </Button>
              </Link>
            )}
            {(user?.role === 'executive' ||
              user?.role === 'manager' ||
              user?.role === 'finance') && (
              <Link href={`/tenders/${id}/finance-tracking`}>
                <Button variant="outline">
                  <IndianRupee className="mr-2 h-4 w-4" />
                  Finance Tracking
                </Button>
              </Link>
            )}
            <Link href={`/tenders/${id}/document-preparation`}>
              <Button variant="outline">
                <FolderOpen className="mr-2 h-4 w-4" />
                Document Preparation
              </Button>
            </Link>
            {analysisComplete && (
              <Link href={`/tenders/${id}/nit-analysis`}>
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  NIT Analysis
                </Button>
              </Link>
            )}
            {hasReport && (
              <Link href={`/tenders/${id}/report`}>
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Feasibility Report
                </Button>
              </Link>
            )}
          </div>
          {analysisComplete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => reanalyze.mutate()}
              disabled={reanalyze.isPending || !!jobRunning}
            >
              {reanalyze.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Re-analyze tender
            </Button>
          )}
        </div>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Upload Tender Document
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = '';
              }}
              className="w-full text-sm"
              disabled={uploading || !!jobRunning}
            />
            {uploading && (
              <p className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </p>
            )}
            {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}

            {jobRunning && (
              <div className="mt-4 space-y-3">
                <IntelligenceJobProgress job={job} compact />
                {ocrDocumentId && (
                  <Link
                    href={`/debug/pages?documentId=${ocrDocumentId}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700 hover:text-cyan-900"
                  >
                    <FileSearch className="h-4 w-4" />
                    View OCR text (verify while parameters load)
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              onClick={() => generateReport.mutate()}
              disabled={!analysisComplete || generateReport.isPending}
            >
              {generateReport.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Feasibility Report
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => submitMd.mutate()} disabled={!hasReport || submitMd.isPending}>
              <Send className="mr-2 h-4 w-4" /> Submit to MD
            </Button>
            <Button variant="outline" onClick={() => financeRequest.mutate('EMD')}>
              <IndianRupee className="mr-2 h-4 w-4" /> Request EMD from Finance
            </Button>
            <Button variant="outline" onClick={() => complianceRequest.mutate()}>
              <Shield className="mr-2 h-4 w-4" /> Request Compliance Docs
            </Button>
          </CardContent>
        </Card>
      </div>

      {showAnalysisSection && token && (
        <div className="mb-8">
          <NitAnalysisParametersTable
            tenderId={id}
            token={token}
            userRole={user?.role}
            jobRunning={!!jobRunning}
            ocrReady={paramsReady}
            analysisComplete={analysisComplete}
          />
        </div>
      )}

      {job?.status === 'failed' && (
        <Card className="mb-6 border-red-200">
          <CardContent className="pt-4 text-sm text-red-600">
            Analysis failed: {job.errorMessage || 'Unknown error'}. Re-upload or re-analyze.
          </CardContent>
        </Card>
      )}

      <TenderWorkflowPanel token={token!} tenderId={id} />
    </DashboardLayout>
  );
}
