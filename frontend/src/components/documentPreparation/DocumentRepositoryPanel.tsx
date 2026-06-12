'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Download,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import { downloadPreparationPdf } from '@/lib/documentPreparationApi';
import { getErrorMessage } from '@/lib/errorMessage';
import { ValidationStatusBadge } from './ValidationStatusBadge';
import type { PreparationDocumentRecord, ValidationStatus } from '@/types/documentPreparation';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface Props {
  token: string;
  tenderId: string;
  documents: PreparationDocumentRecord[];
  selectedId: string | null;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onToggleSelect: (id: string, checked: boolean) => void;
  onRefresh: (selectId?: string) => void | Promise<void>;
  onDocumentDeleted?: (documentId: string) => void;
  canEdit: boolean;
  validationByDocId?: Record<string, { status: ValidationStatus; score: number }>;
}

export function DocumentRepositoryPanel({
  token,
  tenderId,
  documents,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onRefresh,
  onDocumentDeleted,
  canEdit,
  validationByDocId = {},
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [actionError, setActionError] = useState('');

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => api.uploadPreparationDocuments(token, tenderId, files),
    onSuccess: async (res) => {
      setActionError('');
      const firstId = res.data[0]?.id;
      await onRefresh(firstId);
    },
    onError: (err) => setActionError(getErrorMessage(err, 'Upload failed')),
  });

  const renameMutation = useMutation({
    mutationFn: ({ docId, displayName }: { docId: string; displayName: string }) =>
      api.renamePreparationDocument(token, tenderId, docId, displayName),
    onSuccess: () => {
      setEditingId(null);
      onRefresh();
    },
    onError: (err) => setActionError(getErrorMessage(err, 'Rename failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => api.deletePreparationDocument(token, tenderId, docId),
    onSuccess: async (_res, docId) => {
      onDocumentDeleted?.(docId);
      await onRefresh();
    },
    onError: (err) => setActionError(getErrorMessage(err, 'Delete failed')),
  });

  const startRename = (doc: PreparationDocumentRecord) => {
    setEditingId(doc.id);
    setEditName(doc.displayName);
  };

  const saveRename = () => {
    if (!editingId || !editName.trim()) return;
    renameMutation.mutate({ docId: editingId, displayName: editName.trim() });
  };

  const busy = uploadMutation.isPending || renameMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Document Repository</h3>
          <span className="text-xs text-muted-foreground">{documents.length} files</span>
        </div>
        {canEdit && (
          <div className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length) uploadMutation.mutate(files);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload PDFs
            </Button>
          </div>
        )}
        {actionError && <p className="mt-2 text-xs text-red-600">{actionError}</p>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {documents.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No documents yet. Upload PDFs to start preparation.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.map((doc) => {
              const isActive = selectedId === doc.id;
              const isChecked = selectedIds.includes(doc.id);
              return (
                <li
                  key={doc.id}
                  className={`px-3 py-2.5 ${isActive ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-start gap-2">
                    {canEdit && (
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(next) => onToggleSelect(doc.id, next === true)}
                        aria-label={`Select ${doc.displayName}`}
                        className="mt-1"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      {editingId === doc.id ? (
                        <div className="flex w-full items-center gap-1">
                          <FileText className="h-4 w-4 shrink-0 text-blue-700" />
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 flex-1 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveRename();
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={saveRename}
                            disabled={renameMutation.isPending}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div
                          role="button"
                          tabIndex={0}
                          className="w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm"
                          onClick={() => onSelect(doc.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelect(doc.id);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-blue-700" />
                            <span className="truncate text-sm font-medium text-slate-800">
                              {doc.displayName}
                            </span>
                            <ValidationStatusBadge
                              status={validationByDocId[doc.id]?.status}
                              score={validationByDocId[doc.id]?.score}
                            />
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {doc.pageCount} pages · {formatBytes(doc.fileSize)} · {doc.source}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void downloadPreparationPdf(token, tenderId, doc.id, doc.displayName)
                        }
                        aria-label="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canEdit && editingId !== doc.id && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => startRename(doc)}
                            aria-label="Rename"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (confirm(`Delete "${doc.displayName}"?`)) {
                                deleteMutation.mutate(doc.id);
                              }
                            }}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
