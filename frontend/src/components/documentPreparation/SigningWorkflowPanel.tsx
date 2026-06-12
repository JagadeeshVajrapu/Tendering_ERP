'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Circle,
  Loader2,
  PenLine,
  Shield,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessage';
import { SignatureCanvas } from './SignatureCanvas';
import type { SigningWorkflow, SignatureHistoryItem } from '@/types/documentPreparation';

interface Props {
  token: string;
  tenderId: string;
  documentId: string | null;
  documentName?: string;
  canWorkflow: boolean;
  canSign: boolean;
  onRefresh: (selectId?: string) => void | Promise<void>;
  onSelectDocument: (id: string) => void;
}

function StepIcon({ status }: { status: string }) {
  if (status === 'signed') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === 'active') return <Circle className="h-4 w-4 fill-blue-500 text-blue-500" />;
  return <Circle className="h-4 w-4 text-slate-300" />;
}

export function SigningWorkflowPanel({
  token,
  tenderId,
  documentId,
  documentName,
  canWorkflow,
  canSign,
  onRefresh,
  onSelectDocument,
}: Props) {
  const queryClient = useQueryClient();
  const [workflowTitle, setWorkflowTitle] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [certificatePem, setCertificatePem] = useState('');
  const [signatureBase64, setSignatureBase64] = useState('');
  const [dscTokenId, setDscTokenId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data: workflowsRes, isFetching } = useQuery({
    queryKey: ['preparation-workflows', tenderId, documentId],
    queryFn: () => api.listPreparationSigningWorkflows(token, tenderId, documentId!),
    enabled: !!token && !!documentId,
  });

  const { data: historyRes } = useQuery({
    queryKey: ['preparation-signature-history', tenderId, documentId],
    queryFn: () => api.getPreparationSignatureHistory(token, tenderId, documentId!),
    enabled: !!token && !!documentId,
  });

  const workflows = workflowsRes?.data ?? [];
  const activeWorkflow: SigningWorkflow | null = workflows[0] ?? null;
  const history: SignatureHistoryItem[] = historyRes?.data ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['preparation-workflows', tenderId] });
    void queryClient.invalidateQueries({ queryKey: ['preparation-signature-history', tenderId] });
    void queryClient.invalidateQueries({ queryKey: ['preparation-audit-logs', tenderId] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.createPreparationSigningWorkflow(token, tenderId, {
        documentId: documentId!,
        title: workflowTitle.trim() || undefined,
      }),
    onSuccess: () => {
      setMessage('Signing workflow created (Executive → Manager → Director)');
      setError('');
      invalidate();
    },
    onError: (err) => setError(getErrorMessage(err, 'Failed to create workflow')),
  });

  const startMutation = useMutation({
    mutationFn: (workflowId: string) =>
      api.startPreparationSigningWorkflow(token, tenderId, workflowId),
    onSuccess: () => {
      setMessage('Workflow started — next signer notified');
      invalidate();
    },
    onError: (err) => setError(getErrorMessage(err, 'Failed to start workflow')),
  });

  const esignMutation = useMutation({
    mutationFn: (workflowId: string) =>
      api.applyPreparationElectronicSign(token, tenderId, workflowId, {
        signatureImageBase64: signatureData!,
      }),
    onSuccess: async (res) => {
      setMessage('Electronic signature applied');
      setSignatureData(null);
      const signedId = res.data.signedDocument?.id;
      if (signedId) {
        await onRefresh(signedId);
        onSelectDocument(signedId);
      } else {
        await onRefresh();
      }
      invalidate();
    },
    onError: (err) => setError(getErrorMessage(err, 'E-sign failed')),
  });

  const dscMutation = useMutation({
    mutationFn: (workflowId: string) =>
      api.applyPreparationDscSign(token, tenderId, workflowId, {
        certificatePem,
        signatureBase64,
        dscTokenId: dscTokenId || undefined,
      }),
    onSuccess: async (res) => {
      setMessage('DSC signature recorded and verified');
      const signedId = res.data.signedDocument?.id;
      if (signedId) {
        await onRefresh(signedId);
        onSelectDocument(signedId);
      } else {
        await onRefresh();
      }
      invalidate();
    },
    onError: (err) => setError(getErrorMessage(err, 'DSC signing failed')),
  });

  const verifyDscMutation = useMutation({
    mutationFn: () => api.verifyPreparationDsc(token, tenderId, documentId!, certificatePem),
    onSuccess: (res) => {
      const data = res.data as { valid?: boolean; message?: string };
      setMessage(data.message || (data.valid ? 'Certificate valid' : 'Certificate invalid'));
    },
    onError: (err) => setError(getErrorMessage(err, 'DSC verification failed')),
  });

  const busy =
    createMutation.isPending ||
    startMutation.isPending ||
    esignMutation.isPending ||
    dscMutation.isPending;

  if (!documentId) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-muted-foreground">
        Select a document to manage signing workflows.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Workflow className="h-4 w-4 text-blue-700" />
          <h3 className="text-sm font-semibold text-slate-900">E-Sign Workflow</h3>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Multi-signer routing: Executive → Manager → Director — {documentName}
        </p>

        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        {message && <p className="mb-2 text-sm text-emerald-700">{message}</p>}

        {canWorkflow && !activeWorkflow && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <Label>Workflow title</Label>
              <Input
                value={workflowTitle}
                onChange={(e) => setWorkflowTitle(e.target.value)}
                placeholder={`Signing — ${documentName}`}
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => createMutation.mutate()}
            >
              Create workflow
            </Button>
          </div>
        )}

        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

        {activeWorkflow && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-800">{activeWorkflow.title}</p>
                <p className="text-xs text-muted-foreground">
                  Status: <span className="capitalize">{activeWorkflow.status.replace(/_/g, ' ')}</span>
                </p>
              </div>
              {canWorkflow && activeWorkflow.status === 'draft' && (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => startMutation.mutate(activeWorkflow.id)}
                >
                  Start workflow
                </Button>
              )}
            </div>

            <ol className="space-y-2">
              {activeWorkflow.steps.map((step) => (
                <li
                  key={step.order}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                    step.status === 'active'
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <StepIcon status={step.status} />
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">
                      {step.order}. {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {step.assignedUserName || step.role}
                      {step.signedAt ? ` · signed ${new Date(step.signedAt).toLocaleString()}` : ''}
                    </p>
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">{step.status}</span>
                </li>
              ))}
            </ol>

            {canSign && activeWorkflow.status === 'in_progress' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-slate-500">
                    <PenLine className="h-3.5 w-3.5" />
                    Electronic signature
                  </p>
                  <SignatureCanvas onChange={setSignatureData} />
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2 w-full"
                    disabled={busy || !signatureData}
                    onClick={() => esignMutation.mutate(activeWorkflow.id)}
                  >
                    Apply e-sign
                  </Button>
                </div>

                <div className="rounded-md border border-slate-200 p-3">
                  <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-slate-500">
                    <Shield className="h-3.5 w-3.5" />
                    Class 3 DSC (USB Token)
                  </p>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Sign with your USB token via emSigner / signer plugin, then paste certificate and
                    signature payload below.
                  </p>
                  <Label className="text-xs">Certificate PEM</Label>
                  <textarea
                    className="mb-2 min-h-[60px] w-full rounded-md border border-slate-200 p-2 text-xs"
                    value={certificatePem}
                    onChange={(e) => setCertificatePem(e.target.value)}
                    placeholder="-----BEGIN CERTIFICATE-----"
                  />
                  <Label className="text-xs">Signature (Base64)</Label>
                  <Input
                    className="mb-2 h-8 text-xs"
                    value={signatureBase64}
                    onChange={(e) => setSignatureBase64(e.target.value)}
                  />
                  <Label className="text-xs">USB Token ID (optional)</Label>
                  <Input
                    className="mb-2 h-8 text-xs"
                    value={dscTokenId}
                    onChange={(e) => setDscTokenId(e.target.value)}
                    placeholder="Token serial / identifier"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!certificatePem || verifyDscMutation.isPending}
                      onClick={() => verifyDscMutation.mutate()}
                    >
                      Verify cert
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || !certificatePem || !signatureBase64}
                      onClick={() => dscMutation.mutate(activeWorkflow.id)}
                    >
                      Submit DSC sign
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Signature history</h4>
          <ul className="space-y-2">
            {history.map((item) => (
              <li key={item.id} className="rounded-md border border-slate-100 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800">
                    {item.signerName} ({item.signerRole})
                  </span>
                  <span className="text-xs uppercase text-muted-foreground">{item.signatureType}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.signedAt).toLocaleString()} · {item.verificationStatus}
                  {item.verificationMessage ? ` — ${item.verificationMessage}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
