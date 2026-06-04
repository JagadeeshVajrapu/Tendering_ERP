'use client';



import { use, useState, useEffect, useCallback } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useRouter } from 'next/navigation';

import { DashboardLayout } from '@/components/layout/DashboardLayout';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Button } from '@/components/ui/button';

import { IntelligenceDashboard, IntelligenceJobProgress } from '@/components/tender/IntelligenceDashboard';

import { ExtractedParametersTable } from '@/components/tender/ExtractedParametersTable';

import { TenderWorkflowPanel } from '@/components/tender/TenderWorkflowPanel';
import { countFoundFields, getNitAnalysisSheet } from '@/lib/nitAnalysis';

import { api } from '@/lib/api';

import { useAuthStore } from '@/stores/authStore';

import { statusColor } from '@/lib/utils';

import type { TenderIntelligence, IntelligenceJob } from '@/types';

import Link from 'next/link';

import { Upload, FileText, Send, IndianRupee, Shield, Loader2, RefreshCw, Scale, FileSearch } from 'lucide-react';

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

  const { token } = useAuthStore();

  const router = useRouter();

  const qc = useQueryClient();

  const [uploading, setUploading] = useState(false);

  const [uploadError, setUploadError] = useState('');

  const [uploadSuccess, setUploadSuccess] = useState(false);

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
      const intel = query.state.data?.data?.intelligence;
      const stillRunning = job && job.status !== 'completed' && job.status !== 'failed';
      const awaitingTable =
        stillRunning && (!intel || intel.phase !== 'complete');
      if (stillRunning || awaitingTable) return 2500;
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

      socket.on('connect_error', (err) => {
        console.warn('[Socket] connect_error:', getErrorMessage(err, 'Cannot connect to server'));
      });

      socket.emit('join:tender', id);

      socket.on('tender:update', (payload: {
      type?: string;
      progress?: number;
      status?: string;
      errorMessage?: string;
      intelligence?: TenderIntelligence;
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
      if (
        payload?.type === 'intelligence:complete' ||
        payload?.type === 'intelligence:preview' ||
        payload?.status === 'completed' ||
        payload?.status === 'failed'
      ) {
        refetch();
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

    setUploadSuccess(false);

    try {

      const res = await api.uploadTender(token!, file, { tenderId: id });

      if (res.data?.job) setLiveJob(res.data.job);
      if (res.data?.document?.id) setLastDocumentId(String(res.data.document.id));

      setUploadSuccess(true);

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
      setUploadSuccess(false);
      setUploadError('');
      refetch();
      qc.invalidateQueries({ queryKey: ['tender', id] });
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

  const analysisComplete = intelligence?.phase === 'complete' && job?.status === 'completed';

  const hasPartialExtraction = job && (job.status === 'failed' || job.status === 'analyzing') && (job.progress ?? 0) >= 28;

  const showExtractionTable = analysisComplete || !!hasPartialExtraction;

  const jobRunning = job && !analysisComplete && job.status !== 'failed';

  const hasNitTable =
    !!intelligence && countFoundFields(getNitAnalysisSheet(intelligence)) > 0;

  const ocrDocumentId =
    lastDocumentId ||
    (job?.documentId ? String(job.documentId) : null) ||
    null;



  return (

    <DashboardLayout>

      <div className="mb-6 flex items-start justify-between">

        <div>

          <h1 className="text-3xl font-bold">{tender?.title}</h1>

          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${statusColor(tender?.status || '')}`}>

            {tender?.currentStage}

          </span>

        </div>

        <div className="flex flex-wrap gap-2">

          {analysisComplete && (
            <Link href={`/tenders/${id}/nit-analysis`}>
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" /> NIT Analysis
              </Button>
            </Link>
          )}

          {analysisComplete && (
            <Link href={`/tenders/${id}/risk-analysis`}>
              <Button variant="outline">
                <Shield className="mr-2 h-4 w-4" /> Risk Analysis
              </Button>
            </Link>
          )}

          {analysisComplete && (
            <Link href={`/tenders/${id}/recommendation`}>
              <Button>
                <Scale className="mr-2 h-4 w-4" /> Executive Recommendation
              </Button>
            </Link>
          )}

          {showExtractionTable && !analysisComplete && (
            <Link href={`/tenders/${id}/nit-analysis`}>
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" /> NIT Analysis
              </Button>
            </Link>
          )}

          {hasReport && (

            <Link href={`/tenders/${id}/report`}>

              <Button variant="outline">

                <FileText className="mr-2 h-4 w-4" /> Feasibility Report

              </Button>

            </Link>

          )}

        </div>

      </div>



      <div className="mb-8 grid gap-4 md:grid-cols-2">

        <Card>

          <CardHeader>

            <CardTitle className="flex items-center gap-2">

              <Upload className="h-5 w-5" /> Upload Tender Document

            </CardTitle>

          </CardHeader>

          <CardContent>

            <p className="mb-3 text-xs text-muted-foreground">

              PDF, DOC, or DOCX (10–500 pages). Full validated analysis runs in background.

            </p>

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

                Uploading document...

              </p>

            )}

            {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}

            {ocrDocumentId && (
              <div className="mt-3 flex flex-col gap-1">
                <Link
                  href={`/debug/pages?documentId=${ocrDocumentId}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700 hover:text-cyan-900"
                >
                  <FileSearch className="h-4 w-4" />
                  View OCR text per page
                </Link>
                <Link
                  href={`/debug/fields?documentId=${ocrDocumentId}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-violet-700 hover:text-violet-900"
                >
                  <FileSearch className="h-4 w-4" />
                  Field Locator (regex / keyword / alias)
                </Link>
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

                  Generating Report...

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



      {jobRunning && !hasNitTable && !showExtractionTable && (
        <div className="mb-6">
          <IntelligenceJobProgress job={job} uploadSuccess={uploadSuccess} documentId={ocrDocumentId} />
        </div>
      )}

      {job?.status === 'failed' && showExtractionTable && (
        <Card className="mb-4 border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4 text-sm text-amber-900">
            Background analysis had an error, but OCR extraction may still be available below. Use{' '}
            <strong>Re-extract</strong> or open <strong>NIT Analysis</strong> for the full table.
          </CardContent>
        </Card>
      )}

      <TenderWorkflowPanel token={token!} tenderId={id} />

      {showExtractionTable && token && (
        <div className="mt-6">
          <ExtractedParametersTable tenderId={id} token={token} />
        </div>
      )}

      {hasNitTable && intelligence && !analysisComplete && (
        <div className="mt-6 space-y-4">
          {jobRunning && (
            <IntelligenceJobProgress job={job} uploadSuccess={uploadSuccess} compact documentId={ocrDocumentId} />
          )}
          {analysisComplete && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => reanalyze.mutate()}
                disabled={reanalyze.isPending || !!jobRunning}
              >
                {reanalyze.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Re-analyzing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Re-analyze Document
                  </>
                )}
              </Button>
            </div>
          )}
          <IntelligenceDashboard intelligence={intelligence} tenderTitle={tender?.title} />
        </div>
      )}



      {job?.status === 'failed' && (

        <Card className="mt-6 border-red-200">

          <CardContent className="pt-6">

            <p className="text-sm text-red-600">

              Analysis failed: {job.errorMessage || 'Unknown error'}. Please re-upload or re-analyze.

            </p>

          </CardContent>

        </Card>

      )}

    </DashboardLayout>

  );

}

