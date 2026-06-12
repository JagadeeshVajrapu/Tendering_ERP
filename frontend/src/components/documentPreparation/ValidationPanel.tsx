'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Loader2,
  Scan,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessage';
import { ValidationStatusBadge } from './ValidationStatusBadge';
import type { DocumentValidation, ValidationStatus } from '@/types/documentPreparation';

interface Props {
  token: string;
  tenderId: string;
  documentId: string | null;
  documentName?: string;
  canEdit: boolean;
  onValidated: () => void;
}

function StatusIcon({ status }: { status: ValidationStatus }) {
  if (status === 'valid') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <FileWarning className="h-4 w-4 text-red-600" />;
}

export function ValidationPanel({
  token,
  tenderId,
  documentId,
  documentName,
  canEdit,
  onValidated,
}: Props) {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { data: validationResponse, refetch, isFetching } = useQuery({
    queryKey: ['preparation-validation', tenderId, documentId],
    queryFn: () => api.getPreparationDocumentValidation(token, tenderId, documentId!),
    enabled: !!token && !!documentId,
    retry: false,
  });

  const validation = validationResponse?.data ?? null;

  const onSuccess = (msg: string) => {
    setError('');
    setMessage(msg);
    void refetch();
    onValidated();
  };

  const requireDocument = () => {
    if (!documentId) throw new Error('Select a document first');
  };

  const validateMutation = useMutation({
    mutationFn: () => {
      requireDocument();
      return api.validatePreparationDocument(token, tenderId, documentId!);
    },
    onSuccess: (res) => onSuccess(`Validated — ${res.data.status.toUpperCase()} (${res.data.score}%)`),
    onError: (err) => setError(getErrorMessage(err, 'Validation failed')),
  });

  const packageMutation = useMutation({
    mutationFn: () => api.validatePreparationPackage(token, tenderId),
    onSuccess: (res) =>
      onSuccess(
        `Package validated — ${res.data.validDocuments} valid, ${res.data.warningDocuments} warning, ${res.data.errorDocuments} error`
      ),
    onError: (err) => setError(getErrorMessage(err, 'Package validation failed')),
  });

  const expiryMutation = useMutation({
    mutationFn: () => {
      requireDocument();
      return api.detectPreparationExpiry(token, tenderId, documentId!);
    },
    onSuccess: (res) =>
      onSuccess(`Expiry scan — ${res.data.findings.length} certificate(s) checked`),
    onError: (err) => setError(getErrorMessage(err, 'Expiry detection failed')),
  });

  const blankMutation = useMutation({
    mutationFn: () => {
      requireDocument();
      return api.detectPreparationBlankPages(token, tenderId, documentId!);
    },
    onSuccess: (res) =>
      onSuccess(
        res.data.blankPages.length
          ? `Blank pages: ${res.data.blankPages.join(', ')}`
          : 'No blank pages found'
      ),
    onError: (err) => setError(getErrorMessage(err, 'Blank page detection failed')),
  });

  const signatureMutation = useMutation({
    mutationFn: () => {
      requireDocument();
      return api.detectPreparationSignature(token, tenderId, documentId!);
    },
    onSuccess: (res) =>
      onSuccess(res.data.hasSignature ? 'Signature indicators found' : 'No signature detected'),
    onError: (err) => setError(getErrorMessage(err, 'Signature detection failed')),
  });

  const busy =
    validateMutation.isPending ||
    packageMutation.isPending ||
    expiryMutation.isPending ||
    blankMutation.isPending ||
    signatureMutation.isPending;

  if (!documentId) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-muted-foreground">
        Select a document to run validation checks.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck className="h-4 w-4" />
            AI Document Validation
          </h3>
          <p className="text-xs text-muted-foreground">
            File size, portal format, blank pages, signatures, and certificate expiry —{' '}
            {documentName}
          </p>
        </div>
        {validation && <ValidationStatusBadge status={validation.status} score={validation.score} />}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => validateMutation.mutate()}
          >
            {validateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Validate document
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => packageMutation.mutate()}
          >
            {packageMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Validate entire package
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => expiryMutation.mutate()}
          >
            Detect expiry
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => blankMutation.mutate()}
          >
            Detect blank pages
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => signatureMutation.mutate()}
          >
            Detect signature
          </Button>
        </div>
      )}

      {isFetching && !validation && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading validation result…
        </div>
      )}

      {!validation && !isFetching && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-muted-foreground">
          Not validated yet. Run <strong>Validate document</strong> for a full check. Tip: run OCR
          first for better signature and certificate detection on scanned PDFs.
        </p>
      )}

      {validation && (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Validation checks
            </p>
            {validation.checks.map((check) => (
              <div
                key={check.id}
                className="flex items-start gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <StatusIcon status={check.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium capitalize text-slate-800">
                    {check.category.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground">{check.message}</p>
                </div>
                <ValidationStatusBadge status={check.status} />
              </div>
            ))}
          </div>

          {validation.certificateFindings.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Scan className="h-3.5 w-3.5" />
                Certificate monitoring
              </p>
              {validation.certificateFindings.map((cert, idx) => (
                <div
                  key={`${cert.type}-${idx}`}
                  className="rounded-md border border-slate-100 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{cert.name}</span>
                    <ValidationStatusBadge
                      status={cert.status === 'unknown' ? 'warning' : cert.status}
                    />
                  </div>
                  {cert.expiryDate && (
                    <p className="text-xs text-muted-foreground">
                      Expiry: {cert.expiryDate}
                      {cert.daysUntilExpiry !== undefined &&
                        ` (${cert.daysUntilExpiry} days)`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
