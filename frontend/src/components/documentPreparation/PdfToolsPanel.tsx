'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Combine,
  Loader2,
  RotateCw,
  Scissors,
  Shrink,
  Tags,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessage';
import type { PreparationDocumentRecord } from '@/types/documentPreparation';

interface Props {
  token: string;
  tenderId: string;
  documents: PreparationDocumentRecord[];
  selectedIds: string[];
  activeDocumentId: string | null;
  onRefresh: (selectId?: string) => void | Promise<void>;
  onSelectDocument: (id: string) => void;
  canEdit: boolean;
}

function normalizePageRange(
  fromRaw: string,
  toRaw: string,
  maxPages?: number
): { from: number; to: number; adjusted?: string; error?: string } {
  const from = parseInt(fromRaw, 10);
  const to = parseInt(toRaw, 10);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return { from: 1, to: 1, error: 'Enter valid page numbers' };
  }
  if (from < 1 || to < 1) {
    return { from: 1, to: 1, error: 'Page numbers must be at least 1' };
  }

  let normalizedFrom = from;
  let normalizedTo = to;
  if (normalizedFrom > normalizedTo) {
    [normalizedFrom, normalizedTo] = [normalizedTo, normalizedFrom];
  }

  if (maxPages && maxPages > 0) {
    const clampedFrom = Math.min(Math.max(1, normalizedFrom), maxPages);
    const clampedTo = Math.min(Math.max(clampedFrom, normalizedTo), maxPages);
    const adjusted =
      clampedFrom !== from || clampedTo !== to
        ? `Using pages ${clampedFrom}–${clampedTo} (this PDF has ${maxPages} page${maxPages === 1 ? '' : 's'})`
        : undefined;
    return { from: clampedFrom, to: clampedTo, adjusted };
  }

  return { from: normalizedFrom, to: normalizedTo };
}

export function PdfToolsPanel({
  token,
  tenderId,
  documents,
  selectedIds,
  activeDocumentId,
  onRefresh,
  onSelectDocument,
  canEdit,
}: Props) {
  const [toolError, setToolError] = useState('');
  const [toolSuccess, setToolSuccess] = useState('');
  const [mergeName, setMergeName] = useState('');
  const [splitFrom, setSplitFrom] = useState('1');
  const [splitTo, setSplitTo] = useState('1');
  const [splitName, setSplitName] = useState('');
  const [compressName, setCompressName] = useState('');
  const [rotateDegrees, setRotateDegrees] = useState<'90' | '180' | '270'>('90');
  const [rotatePages, setRotatePages] = useState('');
  const [rotateName, setRotateName] = useState('');
  const [bulkNames, setBulkNames] = useState<Record<string, string>>({});

  const activeDoc = documents.find((d) => d.id === activeDocumentId) ?? null;

  useEffect(() => {
    if (!activeDoc) return;
    const pages = activeDoc.pageCount > 0 ? activeDoc.pageCount : 1;
    setSplitFrom('1');
    setSplitTo(String(pages));
    setToolError('');
  }, [activeDoc?.id, activeDoc?.pageCount]);

  const handleSuccess = async (message: string, documentId?: string) => {
    setToolError('');
    setToolSuccess(message);
    await onRefresh(documentId);
    if (documentId) onSelectDocument(documentId);
  };

  const mergeMutation = useMutation({
    mutationFn: () => {
      const documentIds = selectedIds.filter((id) => documents.some((d) => d.id === id));
      if (documentIds.length < 2) {
        throw new Error('Select at least two valid documents to merge');
      }
      return api.mergePreparationPdfs(token, tenderId, {
        documentIds,
        outputName: mergeName.trim() || undefined,
      });
    },
    onSuccess: (res) => {
      const created = res.data;
      handleSuccess(`Merged into “${created.displayName}”`, created.id);
    },
    onError: (err) => {
      setToolSuccess('');
      setToolError(getErrorMessage(err, 'Merge failed'));
    },
  });

  const splitMutation = useMutation({
    mutationFn: (range: { from: number; to: number }) => {
      if (!activeDocumentId) throw new Error('Select a document to split');
      return api.splitPreparationPdf(token, tenderId, {
        documentId: activeDocumentId,
        ranges: [
          {
            from: range.from,
            to: range.to,
            name: splitName.trim() || undefined,
          },
        ],
      });
    },
    onSuccess: (res, range) => {
      const created = res.data;
      const first = created[0];
      const fromPage = first.metadata?.fromPage ?? range.from;
      const toPage = first.metadata?.toPage ?? range.to;
      handleSuccess(
        created.length === 1
          ? `Split complete — created “${first.displayName}” (pages ${fromPage}–${toPage})`
          : `Split complete — created ${created.length} files`,
        first?.id
      );
    },
    onError: (err) => {
      setToolSuccess('');
      setToolError(getErrorMessage(err, 'Split failed'));
    },
  });

  const runSplit = () => {
    setToolError('');
    setToolSuccess('');
    if (!activeDocumentId) {
      setToolError('Select a document to split');
      return;
    }
    const range = normalizePageRange(splitFrom, splitTo, activeDoc?.pageCount);
    if (range.error) {
      setToolError(range.error);
      return;
    }
    if (range.adjusted) setToolSuccess(range.adjusted);
    splitMutation.mutate({ from: range.from, to: range.to });
  };

  const compressMutation = useMutation({
    mutationFn: () => {
      if (!activeDocumentId) throw new Error('Select a document to compress');
      return api.compressPreparationPdf(token, tenderId, {
        documentId: activeDocumentId,
        outputName: compressName.trim() || undefined,
      });
    },
    onSuccess: (res) => {
      const created = res.data;
      const meta = created.metadata as { originalSize?: number; compressedSize?: number };
      const saved =
        meta.originalSize && meta.compressedSize
          ? ` (${Math.max(0, meta.originalSize - meta.compressedSize)} bytes smaller)`
          : '';
      handleSuccess(`Compressed — created “${created.displayName}”${saved}`, created.id);
    },
    onError: (err) => {
      setToolSuccess('');
      setToolError(getErrorMessage(err, 'Compress failed'));
    },
  });

  const rotateMutation = useMutation({
    mutationFn: () => {
      if (!activeDocumentId) throw new Error('Select a document to rotate');
      const pageNumbers = rotatePages
        .split(',')
        .map((p) => parseInt(p.trim(), 10))
        .filter((n) => !Number.isNaN(n));
      return api.rotatePreparationPdf(token, tenderId, {
        documentId: activeDocumentId,
        degrees: parseInt(rotateDegrees, 10) as 90 | 180 | 270,
        pageNumbers: pageNumbers.length ? pageNumbers : undefined,
        outputName: rotateName.trim() || undefined,
      });
    },
    onSuccess: (res) => {
      const created = res.data;
      handleSuccess(`Rotated ${rotateDegrees}° — created “${created.displayName}”`, created.id);
    },
    onError: (err) => {
      setToolSuccess('');
      setToolError(getErrorMessage(err, 'Rotate failed'));
    },
  });

  const bulkRenameMutation = useMutation({
    mutationFn: () => {
      const items = selectedIds
        .filter((id) => documents.some((d) => d.id === id))
        .map((id) => ({
          documentId: id,
          displayName: (bulkNames[id] || documents.find((d) => d.id === id)?.displayName || '').trim(),
        }))
        .filter((item) => item.displayName);
      return api.bulkRenamePreparationDocuments(token, tenderId, items);
    },
    onSuccess: (res) => {
      handleSuccess(`Renamed ${res.data.length} document(s)`);
    },
    onError: (err) => {
      setToolSuccess('');
      setToolError(getErrorMessage(err, 'Bulk rename failed'));
    },
  });

  const busy =
    mergeMutation.isPending ||
    splitMutation.isPending ||
    compressMutation.isPending ||
    rotateMutation.isPending ||
    bulkRenameMutation.isPending;

  if (!canEdit) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
        PDF utilities are available to executives and managers.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">PDF Utilities</h3>
      {activeDoc && (
        <p className="text-xs text-muted-foreground">
          Active document: <strong>{activeDoc.displayName}</strong> ({activeDoc.pageCount} pages)
        </p>
      )}
      {toolError && <p className="text-sm text-red-600">{toolError}</p>}
      {toolSuccess && <p className="text-sm text-emerald-700">{toolSuccess}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Combine className="h-4 w-4" /> Merge PDFs
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            Select 2+ documents from the repository, then merge.
          </p>
          <Label className="text-xs">Output name</Label>
          <Input
            value={mergeName}
            onChange={(e) => setMergeName(e.target.value)}
            placeholder="Merged document"
            className="mb-2 h-8 text-sm"
          />
          <Button
            type="button"
            size="sm"
            disabled={busy || selectedIds.length < 2}
            onClick={() => mergeMutation.mutate()}
          >
            {mergeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Merge {selectedIds.length} selected
          </Button>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Scissors className="h-4 w-4" /> Split PDF
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            Extract a page range from the active preview document.
            {activeDoc?.pageCount ? ` (${activeDoc.pageCount} pages)` : ''}
          </p>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">From page</Label>
              <Input
                value={splitFrom}
                onChange={(e) => setSplitFrom(e.target.value)}
                className="h-8 text-sm"
                inputMode="numeric"
              />
            </div>
            <div>
              <Label className="text-xs">To page</Label>
              <Input
                value={splitTo}
                onChange={(e) => setSplitTo(e.target.value)}
                className="h-8 text-sm"
                inputMode="numeric"
              />
            </div>
          </div>
          <Label className="text-xs">Part name</Label>
          <Input
            value={splitName}
            onChange={(e) => setSplitName(e.target.value)}
            className="mb-2 h-8 text-sm"
            placeholder="Optional"
          />
          <Button
            type="button"
            size="sm"
            disabled={busy || !activeDocumentId}
            onClick={runSplit}
          >
            {splitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Split
          </Button>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Shrink className="h-4 w-4" /> Compress PDF
          </div>
          <Label className="text-xs">Output name</Label>
          <Input
            value={compressName}
            onChange={(e) => setCompressName(e.target.value)}
            className="mb-2 h-8 text-sm"
            placeholder="Optional"
          />
          <Button
            type="button"
            size="sm"
            disabled={busy || !activeDocumentId}
            onClick={() => compressMutation.mutate()}
          >
            {compressMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Compress active PDF
          </Button>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <RotateCw className="h-4 w-4" /> Rotate pages
          </div>
          <div className="mb-2 flex gap-2">
            {(['90', '180', '270'] as const).map((deg) => (
              <Button
                key={deg}
                type="button"
                size="sm"
                variant={rotateDegrees === deg ? 'default' : 'outline'}
                onClick={() => setRotateDegrees(deg)}
              >
                {deg}°
              </Button>
            ))}
          </div>
          <Label className="text-xs">Page numbers (comma-separated, empty = all)</Label>
          <Input
            value={rotatePages}
            onChange={(e) => setRotatePages(e.target.value)}
            className="mb-2 h-8 text-sm"
            placeholder="1, 2, 3"
          />
          <Label className="text-xs">Output name</Label>
          <Input
            value={rotateName}
            onChange={(e) => setRotateName(e.target.value)}
            className="mb-2 h-8 text-sm"
            placeholder="Optional"
          />
          <Button
            type="button"
            size="sm"
            disabled={busy || !activeDocumentId}
            onClick={() => rotateMutation.mutate()}
          >
            {rotateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Rotate
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Tags className="h-4 w-4" /> Bulk rename
        </div>
        {selectedIds.length === 0 ? (
          <p className="text-xs text-muted-foreground">Select documents to rename in bulk.</p>
        ) : (
          <div className="space-y-2">
            {selectedIds.map((id) => {
              const doc = documents.find((d) => d.id === id);
              return (
                <div key={id} className="flex items-center gap-2">
                  <span className="w-32 truncate text-xs text-muted-foreground">{doc?.displayName}</span>
                  <Input
                    value={bulkNames[id] ?? doc?.displayName ?? ''}
                    onChange={(e) => setBulkNames((prev) => ({ ...prev, [id]: e.target.value }))}
                    className="h-8 flex-1 text-sm"
                  />
                </div>
              );
            })}
            <Button type="button" size="sm" disabled={busy} onClick={() => bulkRenameMutation.mutate()}>
              {bulkRenameMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Apply bulk rename
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
