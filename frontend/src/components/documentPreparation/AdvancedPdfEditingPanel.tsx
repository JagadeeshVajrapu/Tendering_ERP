'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Eraser, Highlighter, Loader2, LockOpen, MessageSquare, Stamp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessage';
import type { MarkupRegion } from '@/types/documentPreparation';

interface Props {
  token: string;
  tenderId: string;
  documentId: string | null;
  documentName?: string;
  canEdit: boolean;
  onRefresh: (selectId?: string) => void | Promise<void>;
  onSelectDocument: (id: string) => void;
}

const DEFAULT_REGION: MarkupRegion = {
  pageNumber: 1,
  x: 72,
  y: 500,
  width: 200,
  height: 40,
};

export function AdvancedPdfEditingPanel({
  token,
  tenderId,
  documentId,
  documentName,
  canEdit,
  onRefresh,
  onSelectDocument,
}: Props) {
  const [password, setPassword] = useState('');
  const [region, setRegion] = useState<MarkupRegion>(DEFAULT_REGION);
  const [annotationText, setAnnotationText] = useState('');
  const [stampLabel, setStampLabel] = useState('APPROVED');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const onDone = async (docId: string, msg: string) => {
    setError('');
    setMessage(msg);
    await onRefresh(docId);
    onSelectDocument(docId);
  };

  const unlockMutation = useMutation({
    mutationFn: () =>
      api.unlockPreparationPdf(token, tenderId, {
        documentId: documentId!,
        password,
      }),
    onSuccess: (res) => onDone(res.data.id, `Unlocked — “${res.data.displayName}”`),
    onError: (err) => setError(getErrorMessage(err, 'Unlock failed')),
  });

  const markupMutation = useMutation({
    mutationFn: (markupType: 'redaction' | 'annotation' | 'highlight' | 'stamp') =>
      api.applyPreparationMarkup(token, tenderId, {
        documentId: documentId!,
        markupType,
        regions: [
          {
            ...region,
            text: markupType === 'annotation' ? annotationText : undefined,
            stampLabel: markupType === 'stamp' ? stampLabel : undefined,
          },
        ],
      }),
    onSuccess: (res, type) =>
      onDone(res.data.id, `${type} applied — “${res.data.displayName}”`),
    onError: (err) => setError(getErrorMessage(err, 'Markup failed')),
  });

  const busy = unlockMutation.isPending || markupMutation.isPending;

  if (!documentId) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-muted-foreground">
        Select a document for advanced PDF editing.
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
        Advanced editing tools are available to executives and managers.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Advanced PDF Editing</h3>
        <p className="text-xs text-muted-foreground">
          Unlock, redact, annotate, highlight, and stamp — {documentName}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-md border border-slate-200 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <LockOpen className="h-3.5 w-3.5" />
            Unlock password-protected PDF
          </p>
          <Label htmlFor="pdf-password">Password</Label>
          <Input
            id="pdf-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter PDF password"
          />
          <Button
            type="button"
            size="sm"
            disabled={busy || !password}
            onClick={() => unlockMutation.mutate()}
          >
            {unlockMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Unlock PDF
          </Button>
        </div>

        <div className="space-y-3 rounded-md border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Placement (PDF points)</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Page</Label>
              <Input
                type="number"
                min={1}
                value={region.pageNumber}
                onChange={(e) =>
                  setRegion((r) => ({ ...r, pageNumber: parseInt(e.target.value, 10) || 1 }))
                }
              />
            </div>
            <div>
              <Label>X</Label>
              <Input
                type="number"
                value={region.x}
                onChange={(e) => setRegion((r) => ({ ...r, x: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div>
              <Label>Y</Label>
              <Input
                type="number"
                value={region.y}
                onChange={(e) => setRegion((r) => ({ ...r, y: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div>
              <Label>Width</Label>
              <Input
                type="number"
                value={region.width}
                onChange={(e) =>
                  setRegion((r) => ({ ...r, width: parseInt(e.target.value, 10) || 0 }))
                }
              />
            </div>
            <div className="col-span-2">
              <Label>Height</Label>
              <Input
                type="number"
                value={region.height}
                onChange={(e) =>
                  setRegion((r) => ({ ...r, height: parseInt(e.target.value, 10) || 0 }))
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-slate-200 p-3">
          <p className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-700">
            <Eraser className="h-3.5 w-3.5" />
            Redaction
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => markupMutation.mutate('redaction')}
          >
            Apply redaction
          </Button>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <p className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-700">
            <MessageSquare className="h-3.5 w-3.5" />
            Annotation
          </p>
          <Input
            className="mb-2 h-8 text-xs"
            value={annotationText}
            onChange={(e) => setAnnotationText(e.target.value)}
            placeholder="Note text"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={busy || !annotationText.trim()}
            onClick={() => markupMutation.mutate('annotation')}
          >
            Add annotation
          </Button>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <p className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-700">
            <Highlighter className="h-3.5 w-3.5" />
            Highlight
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => markupMutation.mutate('highlight')}
          >
            Apply highlight
          </Button>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <p className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-700">
            <Stamp className="h-3.5 w-3.5" />
            Stamp
          </p>
          <Input
            className="mb-2 h-8 text-xs"
            value={stampLabel}
            onChange={(e) => setStampLabel(e.target.value)}
            placeholder="APPROVED"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={busy || !stampLabel.trim()}
            onClick={() => markupMutation.mutate('stamp')}
          >
            Place stamp
          </Button>
        </div>
      </div>
    </div>
  );
}
