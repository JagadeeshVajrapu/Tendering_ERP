'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Hash, Heading, Loader2, Stamp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessage';

interface Props {
  token: string;
  tenderId: string;
  activeDocumentId: string | null;
  activeDocumentName?: string;
  onRefresh: (selectId?: string) => void | Promise<void>;
  onSelectDocument: (id: string) => void;
  canEdit: boolean;
}

export function PdfEditingPanel({
  token,
  tenderId,
  activeDocumentId,
  activeDocumentName,
  onRefresh,
  onSelectDocument,
  canEdit,
}: Props) {
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [pageFormat, setPageFormat] = useState('Page {n} of {total}');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const onDone = async (docId: string, success: string) => {
    setError('');
    setMessage(success);
    await onRefresh(docId);
    onSelectDocument(docId);
  };

  const headerFooterMutation = useMutation({
    mutationFn: () =>
      api.addPreparationHeaderFooter(token, tenderId, {
        documentId: activeDocumentId!,
        headerText,
        footerText,
      }),
    onSuccess: (res) => onDone(res.data.id, `Header/footer added — “${res.data.displayName}”`),
    onError: (err) => setError(getErrorMessage(err, 'Failed to add header/footer')),
  });

  const watermarkMutation = useMutation({
    mutationFn: () =>
      api.addPreparationWatermark(token, tenderId, {
        documentId: activeDocumentId!,
        watermarkText,
        opacity: 0.3,
      }),
    onSuccess: (res) => onDone(res.data.id, `Watermark added — “${res.data.displayName}”`),
    onError: (err) => setError(getErrorMessage(err, 'Failed to add watermark')),
  });

  const pageNumbersMutation = useMutation({
    mutationFn: () =>
      api.addPreparationPageNumbers(token, tenderId, {
        documentId: activeDocumentId!,
        format: pageFormat,
        position: 'bottom-center',
      }),
    onSuccess: (res) => onDone(res.data.id, `Page numbers added — “${res.data.displayName}”`),
    onError: (err) => setError(getErrorMessage(err, 'Failed to add page numbers')),
  });

  const busy =
    headerFooterMutation.isPending || watermarkMutation.isPending || pageNumbersMutation.isPending;

  if (!canEdit) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
        PDF editing tools are available to executives and managers.
      </div>
    );
  }

  const runHeaderFooter = () => {
    setError('');
    setMessage('');
    if (!activeDocumentId) {
      setError('Select a document first');
      return;
    }
    if (!headerText.trim() && !footerText.trim()) {
      setError('Enter header and/or footer text');
      return;
    }
    headerFooterMutation.mutate();
  };

  const runWatermark = () => {
    setError('');
    setMessage('');
    if (!activeDocumentId) {
      setError('Select a document first');
      return;
    }
    if (!watermarkText.trim()) {
      setError('Enter watermark text');
      return;
    }
    watermarkMutation.mutate();
  };

  const runPageNumbers = () => {
    setError('');
    setMessage('');
    if (!activeDocumentId) {
      setError('Select a document first');
      return;
    }
    pageNumbersMutation.mutate();
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">PDF Editing</h3>
        <p className="text-xs text-muted-foreground">
          Apply headers, footers, watermarks, and page numbers to{' '}
          {activeDocumentName || 'the selected document'}. Creates a new PDF copy.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Heading className="h-4 w-4" /> Header &amp; Footer
          </div>
          <Label className="text-xs">Header text</Label>
          <Input
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
            className="mb-2 h-8 text-sm"
            placeholder="Company name — Tender ref"
          />
          <Label className="text-xs">Footer text</Label>
          <Input
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            className="mb-2 h-8 text-sm"
            placeholder="Confidential — Page footer note"
          />
          <Button type="button" size="sm" disabled={busy || !activeDocumentId} onClick={runHeaderFooter}>
            {headerFooterMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Apply
          </Button>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Stamp className="h-4 w-4" /> Watermark
          </div>
          <Label className="text-xs">Watermark text</Label>
          <Input
            value={watermarkText}
            onChange={(e) => setWatermarkText(e.target.value)}
            className="mb-2 h-8 text-sm"
          />
          <Button type="button" size="sm" disabled={busy || !activeDocumentId} onClick={runWatermark}>
            {watermarkMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Apply watermark
          </Button>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Hash className="h-4 w-4" /> Page numbers
          </div>
          <Label className="text-xs">Format</Label>
          <Input
            value={pageFormat}
            onChange={(e) => setPageFormat(e.target.value)}
            className="mb-2 h-8 text-sm"
            placeholder="Page {n} of {total}"
          />
          <Button type="button" size="sm" disabled={busy || !activeDocumentId} onClick={runPageNumbers}>
            {pageNumbersMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add page numbers
          </Button>
        </div>
      </div>
    </div>
  );
}
