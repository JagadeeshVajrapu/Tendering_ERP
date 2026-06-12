'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PdfViewer } from './PdfViewer';
import { DocumentRepositoryPanel } from './DocumentRepositoryPanel';
import { PdfToolsPanel } from './PdfToolsPanel';
import { OcrPreviewPanel } from './OcrPreviewPanel';
import { PdfEditingPanel } from './PdfEditingPanel';
import { TemplateFillPanel } from './TemplateFillPanel';
import { ValidationPanel } from './ValidationPanel';
import { ValidationDashboardPanel } from './ValidationDashboardPanel';
import { AdvancedPdfEditingPanel } from './AdvancedPdfEditingPanel';
import { SigningWorkflowPanel } from './SigningWorkflowPanel';
import { PreparationAuditLogPanel } from './PreparationAuditLogPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import type { PreparationDocumentListResult, ValidationStatus } from '@/types/documentPreparation';

interface Props {
  token: string;
  tenderId: string;
  data: PreparationDocumentListResult;
  userRole?: string;
  onRefresh: () => void | Promise<void>;
}

function canEditDocuments(role?: string): boolean {
  const r = role?.toLowerCase();
  return r === 'executive' || r === 'manager';
}

function canManageWorkflow(role?: string): boolean {
  const r = role?.toLowerCase();
  return r === 'executive' || r === 'manager';
}

function canSignDocuments(role?: string): boolean {
  const r = role?.toLowerCase();
  return r === 'executive' || r === 'manager' || r === 'md';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentPreparationView({ token, tenderId, data, userRole, onRefresh }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(data.documents[0]?.id ?? null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hiddenDocIds, setHiddenDocIds] = useState<string[]>([]);
  const canEdit = canEditDocuments(userRole);
  const canWorkflow = canManageWorkflow(userRole);
  const canSign = canSignDocuments(userRole);

  const documents = useMemo(
    () => data.documents.filter((d) => !hiddenDocIds.includes(d.id)),
    [data.documents, hiddenDocIds]
  );

  useEffect(() => {
    setHiddenDocIds([]);
  }, [data.documents]);

  useEffect(() => {
    const ids = new Set(documents.map((d) => d.id));
    setSelectedIds((prev) => prev.filter((id) => ids.has(id)));
    setSelectedId((current) => {
      if (current && ids.has(current)) return current;
      return documents[0]?.id ?? null;
    });
  }, [documents]);

  const activeDocumentId = useMemo(() => {
    if (!selectedId) return null;
    return documents.find((d) => d.id === selectedId)?.id ?? null;
  }, [selectedId, documents]);

  const refreshDocuments = useCallback(
    async (selectId?: string) => {
      await onRefresh();
      if (selectId) {
        setSelectedId(selectId);
      }
    },
    [onRefresh]
  );

  const { data: dashboardResponse, isLoading: dashboardLoading, refetch: refetchDashboard } =
    useQuery({
      queryKey: ['preparation-validation-dashboard', tenderId],
      queryFn: () => api.getPreparationValidationDashboard(token, tenderId),
      enabled: !!token,
      staleTime: 15_000,
    });

  const dashboard = dashboardResponse?.data ?? null;

  const validationByDocId = useMemo(() => {
    const map: Record<string, { status: ValidationStatus; score: number }> = {};
    dashboard?.validations.forEach((v) => {
      map[v.documentId] = { status: v.status, score: v.score };
    });
    return map;
  }, [dashboard?.validations]);

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocumentId) ?? null,
    [documents, activeDocumentId]
  );

  const handleDocumentDeleted = (deletedId: string) => {
    setHiddenDocIds((prev) => [...prev, deletedId]);
    setSelectedIds((prev) => prev.filter((id) => id !== deletedId));
    setSelectedId((current) => {
      if (current !== deletedId) return current;
      const remaining = documents.filter((d) => d.id !== deletedId);
      return remaining[0]?.id ?? null;
    });
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  };

  const refreshValidation = () => {
    void refetchDashboard();
    void queryClient.invalidateQueries({ queryKey: ['preparation-validation', tenderId] });
  };

  return (
    <div className="space-y-5">
      <ValidationDashboardPanel dashboard={dashboard} isLoading={dashboardLoading} />

      <div className="grid gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Documents</p>
          <p className="text-2xl font-bold text-blue-900">{data.totalCount}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total size</p>
          <p className="text-2xl font-bold text-slate-900">{formatBytes(data.totalSize)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Active preview</p>
          <p className="truncate text-lg font-semibold text-slate-800">
            {activeDoc?.displayName || 'None selected'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <DocumentRepositoryPanel
          token={token}
          tenderId={tenderId}
          documents={documents}
          selectedId={activeDocumentId}
          selectedIds={selectedIds}
          onSelect={setSelectedId}
          onToggleSelect={toggleSelect}
          onRefresh={refreshDocuments}
          onDocumentDeleted={handleDocumentDeleted}
          canEdit={canEdit}
          validationByDocId={validationByDocId}
        />
        <PdfViewer
          token={token}
          tenderId={tenderId}
          documentId={activeDocumentId}
          documentName={activeDoc?.displayName}
        />
      </div>

      <Tabs defaultValue="validation" className="w-full">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="ocr">OCR</TabsTrigger>
          <TabsTrigger value="editing">Editing</TabsTrigger>
          <TabsTrigger value="template">Template Auto-Fill</TabsTrigger>
          <TabsTrigger value="utilities">PDF Utilities</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Editing</TabsTrigger>
          <TabsTrigger value="signing">Signing</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="validation">
          <ValidationPanel
            token={token}
            tenderId={tenderId}
            documentId={activeDocumentId}
            documentName={activeDoc?.displayName}
            canEdit={canEdit}
            onValidated={refreshValidation}
          />
        </TabsContent>

        <TabsContent value="ocr">
          <OcrPreviewPanel
            token={token}
            tenderId={tenderId}
            documentId={activeDocumentId}
            documentName={activeDoc?.displayName}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="editing">
          <PdfEditingPanel
            token={token}
            tenderId={tenderId}
            activeDocumentId={activeDocumentId}
            activeDocumentName={activeDoc?.displayName}
            onRefresh={refreshDocuments}
            onSelectDocument={setSelectedId}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="template">
          <TemplateFillPanel
            token={token}
            tenderId={tenderId}
            activeDocumentId={activeDocumentId}
            activeDocumentName={activeDoc?.displayName}
            onRefresh={refreshDocuments}
            onSelectDocument={setSelectedId}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="utilities">
          <PdfToolsPanel
            token={token}
            tenderId={tenderId}
            documents={documents}
            selectedIds={selectedIds}
            activeDocumentId={activeDocumentId}
            onRefresh={refreshDocuments}
            onSelectDocument={setSelectedId}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="advanced">
          <AdvancedPdfEditingPanel
            token={token}
            tenderId={tenderId}
            documentId={activeDocumentId}
            documentName={activeDoc?.displayName}
            canEdit={canEdit}
            onRefresh={refreshDocuments}
            onSelectDocument={setSelectedId}
          />
        </TabsContent>

        <TabsContent value="signing">
          <SigningWorkflowPanel
            token={token}
            tenderId={tenderId}
            documentId={activeDocumentId}
            documentName={activeDoc?.displayName}
            canWorkflow={canWorkflow}
            canSign={canSign}
            onRefresh={refreshDocuments}
            onSelectDocument={setSelectedId}
          />
        </TabsContent>

        <TabsContent value="audit">
          <PreparationAuditLogPanel
            token={token}
            tenderId={tenderId}
            documentId={activeDocumentId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
