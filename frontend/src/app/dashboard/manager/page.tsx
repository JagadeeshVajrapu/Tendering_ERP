'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/lib/utils';
import { Clock, CheckCircle, Upload, FileText, Download } from 'lucide-react';
import { useRef } from 'react';
import type { ComplianceDocument, ComplianceRequestRecord } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001';

function complianceDocKey(requestId: string, doc: ComplianceDocument | string, index: number): string {
  if (typeof doc === 'string') return `${requestId}-doc-${doc}-${index}`;
  const id = doc?._id;
  if (id) return String(id);
  return `${requestId}-doc-${doc?.originalName ?? 'file'}-${index}`;
}

export default function ManagerDashboard() {
  const { token } = useAuthStore();
  const qc = useQueryClient();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'manager'],
    queryFn: () => api.getManagerDashboard(token!),
    enabled: !!token,
    refetchInterval: 15000,
  });

  const uploadDoc = useMutation({
    mutationFn: ({ requestId, file }: { requestId: string; file: File }) =>
      api.uploadComplianceDocument(token!, requestId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'manager'] }),
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.approveCompliance(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'manager'] }),
  });

  const dashboard = data?.data;
  const pending = (dashboard?.pending as ComplianceRequestRecord[]) || [];
  const completed = (dashboard?.completed as ComplianceRequestRecord[]) || [];

  const historyColumns = [
    {
      key: 'tender',
      header: 'Tender',
      render: (row: ComplianceRequestRecord) => row.tenderId?.title || '—',
    },
    {
      key: 'executive',
      header: 'Requested By',
      render: (row: ComplianceRequestRecord) => (
        <div>
          <p className="font-medium">{row.requestedBy?.name || '—'}</p>
          <p className="text-xs text-muted-foreground">{row.requestedBy?.email}</p>
        </div>
      ),
    },
    {
      key: 'docs',
      header: 'Documents Requested',
      render: (row: ComplianceRequestRecord) => (
        <div className="flex flex-wrap gap-1">
          {row.documentTypes.map((d) => (
            <span key={d} className="rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700">{d}</span>
          ))}
        </div>
      ),
    },
    {
      key: 'uploaded',
      header: 'Files Sent',
      render: (row: ComplianceRequestRecord) => row.documentIds?.length || 0,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: ComplianceRequestRecord) => <StatusBadge status={row.status} />,
    },
    {
      key: 'date',
      header: 'Date',
      render: (row: ComplianceRequestRecord) => formatDate(row.decidedAt || row.createdAt),
    },
  ];

  function docUrl(doc: { s3Url?: string; localPath?: string }) {
    if (doc.s3Url?.startsWith('http')) return doc.s3Url;
    if (doc.localPath) return `${API_BASE}/uploads/${doc.localPath}`;
    return doc.s3Url || '#';
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Compliance Desk</h1>
        <p className="text-muted-foreground">Fulfill executive compliance requests and upload documents</p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{pending.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{completed.length}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Active Requests ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">History ({completed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6 space-y-4">
          {isLoading && <p>Loading...</p>}
          {pending.map((req) => (
            <Card key={req._id}>
              <CardHeader>
                <CardTitle className="text-lg">{req.tenderId?.title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Requested by <strong>{req.requestedBy?.name}</strong> · {formatDate(req.createdAt)}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium">Documents needed:</p>
                  <div className="flex flex-wrap gap-2">
                    {req.documentTypes.map((d) => (
                      <span key={d} className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">{d}</span>
                    ))}
                  </div>
                </div>

                {req.documentIds && req.documentIds.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Uploaded files:</p>
                    <ul className="space-y-1">
                      {req.documentIds.map((doc, index) => (
                        <li key={complianceDocKey(req._id, doc, index)} className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-blue-600" />
                          {typeof doc === 'string' ? doc : doc.originalName}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    className="hidden"
                    ref={(el) => { fileRefs.current[req._id] = el; }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadDoc.mutate({ requestId: req._id, file });
                      e.target.value = '';
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileRefs.current[req._id]?.click()} disabled={uploadDoc.isPending}>
                    <Upload className="mr-2 h-4 w-4" /> Upload Document for Executive
                  </Button>
                  <Button size="sm" onClick={() => approve.mutate(req._id)} disabled={approve.isPending || !req.documentIds?.length}>
                    <CheckCircle className="mr-2 h-4 w-4" /> Mark Complete & Notify Executive
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {pending.length === 0 && !isLoading && (
            <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">No pending compliance requests</div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6 space-y-6">
          <DataTable columns={historyColumns} data={completed} emptyMessage="No completed requests yet" />
          {completed.map((req) =>
            req.documentIds && req.documentIds.length > 0 ? (
              <Card key={`files-${req._id}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{req.tenderId?.title} — Files sent to {req.requestedBy?.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {req.documentIds.map((doc, index) => (
                    <a
                      key={complianceDocKey(req._id, doc, index)}
                      href={typeof doc === 'string' ? '#' : docUrl(doc)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                      <Download className="h-4 w-4" />{' '}
                      {typeof doc === 'string' ? doc : doc.originalName}
                    </a>
                  ))}
                </CardContent>
              </Card>
            ) : null
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
