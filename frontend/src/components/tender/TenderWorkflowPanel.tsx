'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { IndianRupee, Shield, ClipboardCheck, Download } from 'lucide-react';
import type { FinanceRequestRecord, ComplianceRequestRecord, MdApprovalRecord } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001';

function docUrl(doc: { s3Url?: string; localPath?: string }) {
  if (doc.s3Url?.startsWith('http')) return doc.s3Url;
  if (doc.localPath) return `${API_BASE}/uploads/${doc.localPath}`;
  return doc.s3Url || '#';
}

export function TenderWorkflowPanel({ token, tenderId }: { token: string; tenderId: string }) {
  const { data } = useQuery({
    queryKey: ['workflow', tenderId],
    queryFn: () => api.getTenderWorkflow(token, tenderId),
    enabled: !!token,
  });

  const finance = data?.data?.financeRequests || [];
  const compliance = data?.data?.complianceRequests || [];
  const mdApprovals = data?.data?.mdApprovals || [];

  if (!finance.length && !compliance.length && !mdApprovals.length) return null;

  return (
    <div className="mb-8 grid gap-4 lg:grid-cols-2">
      {finance.length > 0 && (
        <Card className="border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IndianRupee className="h-5 w-5" /> Finance & Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {finance.map((req: FinanceRequestRecord) => (
              <div key={req._id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{req.requestType} — {formatCurrency(req.amount)}</span>
                  <StatusBadge status={req.status} />
                </div>
                {(req.utrNumber || req.transactionId) && (
                  <p className="mt-2 font-mono text-xs text-green-700">
                    Paid · UTR: {req.utrNumber || '—'} {req.transactionId ? `· Txn: ${req.transactionId}` : ''}
                  </p>
                )}
                {req.paidAt && <p className="text-xs text-muted-foreground">Paid on {formatDate(req.paidAt)}</p>}
                {req.approvedBy && !req.utrNumber && (
                  <p className="text-xs text-muted-foreground">Approved by {req.approvedBy.name}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {compliance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5" /> Compliance Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {compliance.map((req: ComplianceRequestRecord) => (
              <div key={req._id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{req.documentTypes.join(', ')}</span>
                  <StatusBadge status={req.status} />
                </div>
                {req.documentIds && req.documentIds.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {req.documentIds.map((doc) => (
                      <li key={doc._id}>
                        <a href={docUrl(doc)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                          <Download className="h-3 w-3" /> {doc.originalName}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {req.approvedBy && (
                  <p className="mt-1 text-xs text-muted-foreground">Fulfilled by {req.approvedBy.name}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mdApprovals.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-5 w-5" /> MD Review History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mdApprovals.map((a: MdApprovalRecord) => (
              <div key={a._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span>Submitted {formatDate(a.createdAt)}</span>
                <StatusBadge status={a.decision} />
                {a.reviewedBy && <span className="text-muted-foreground">by {a.reviewedBy.name}</span>}
                {a.comments && <span className="w-full text-xs text-muted-foreground">Remarks: {a.comments}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
