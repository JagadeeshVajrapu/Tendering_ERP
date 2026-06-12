'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  FileText,
  IndianRupee,
  Loader2,
  Receipt,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessage';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PostAwardContractDetail } from '@/types/postAward';

interface Props {
  token: string;
  tenderId: string;
  canWrite: boolean;
  canApprove: boolean;
  canAward: boolean;
}

export function PostAwardView({ token, tenderId, canWrite, canApprove, canAward }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('work_order');
  const [docNumber, setDocNumber] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tender-post-award', tenderId],
    queryFn: () => api.getTenderPostAward(token, tenderId),
    enabled: !!token,
  });

  const available = data?.data?.available ?? false;
  const contract: PostAwardContractDetail | null = data?.data?.contract ?? null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['tender-post-award', tenderId] });
    void queryClient.invalidateQueries({ queryKey: ['post-award-dashboard'] });
  };

  const awardMutation = useMutation({
    mutationFn: () => api.markTenderAwarded(token, tenderId),
    onSuccess: () => {
      setMessage('Tender marked as awarded — post-award module activated');
      setError('');
      invalidate();
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, 'Failed to mark awarded')),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      api.uploadPostAwardDocument(token, tenderId, file, docType, docNumber || undefined),
    onSuccess: () => {
      setDocNumber('');
      setMessage('Document uploaded');
      invalidate();
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, 'Upload failed')),
  });

  const revenueMutation = useMutation({
    mutationFn: (body: { description: string; amount: number }) =>
      api.addPostAwardRevenue(token, tenderId, body),
    onSuccess: () => {
      setMessage('Revenue entry added');
      invalidate();
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, 'Failed to add revenue')),
  });

  const billingMutation = useMutation({
    mutationFn: (body: { description: string; amount: number }) =>
      api.addPostAwardBilling(token, tenderId, body),
    onSuccess: () => {
      setMessage('Billing record added');
      invalidate();
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, 'Failed to add billing')),
  });

  const approveRevenueMutation = useMutation({
    mutationFn: (id: string) => api.approvePostAwardRevenue(token, tenderId, id, true),
    onSuccess: () => {
      invalidate();
      void refetch();
    },
  });

  const approveBillingMutation = useMutation({
    mutationFn: (id: string) => api.approvePostAwardBilling(token, tenderId, id, true),
    onSuccess: () => {
      invalidate();
      void refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-20 text-muted-foreground">
        <Loader2 className="mb-3 h-8 w-8 animate-spin" />
        Loading post-award data…
      </div>
    );
  }

  if (!available) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center shadow-sm dark:bg-slate-900">
        <Award className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Post-Award Follow-Up not yet available</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          This module activates when the tender is marked as <strong>Awarded</strong>. Complete submission
          tracking first, then mark the tender as awarded.
        </p>
        {canAward && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href={`/tenders/${tenderId}/submission-tracking`}>
              <Button variant="outline">Go to Submission Tracking</Button>
            </Link>
            <Button
              onClick={() => awardMutation.mutate()}
              disabled={awardMutation.isPending}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              {awardMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Award className="mr-2 h-4 w-4" />
              )}
              Mark as Awarded
            </Button>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="rounded-xl border p-6 text-center text-muted-foreground">
        Post-award record is being initialized…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(message || error) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Contract Value', value: formatCurrency(contract.contractValue) },
          { label: 'Total Revenue', value: formatCurrency(contract.totalRevenue) },
          { label: 'Received', value: formatCurrency(contract.revenueReceived) },
          { label: 'Pending Billing', value: formatCurrency(contract.pendingBilling) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900">
            <p className="text-xs uppercase text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-lg font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-semibold">Contract Details</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Client</dt>
            <dd className="font-medium">{contract.clientName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Work Order</dt>
            <dd>{contract.workOrderNumber || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Agreement</dt>
            <dd>{contract.agreementNumber || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Purchase Order</dt>
            <dd>{contract.purchaseOrderNumber || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Contract End</dt>
            <dd>{formatDate(contract.contractEndDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">AMC End</dt>
            <dd>{formatDate(contract.amcEndDate)}</dd>
          </div>
        </dl>
      </section>

      {canWrite && (
        <section className="rounded-xl border border-dashed p-4">
          <h3 className="mb-3 text-sm font-semibold">Upload Documents</h3>
          <div className="flex flex-wrap items-end gap-2">
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              <option value="work_order">Work Order</option>
              <option value="agreement">Agreement</option>
              <option value="purchase_order">Purchase Order</option>
            </select>
            <Input
              placeholder="Document number"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              className="max-w-[180px]"
            />
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.png,.jpg"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadMutation.mutate(f);
                e.target.value = '';
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadMutation.isPending}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <IndianRupee className="h-5 w-5" />
            Revenue Tracking
          </h2>
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const desc = prompt('Revenue description');
                const amt = prompt('Amount (₹)');
                if (desc && amt) revenueMutation.mutate({ description: desc, amount: Number(amt) });
              }}
            >
              Add Revenue
            </Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approval</TableHead>
              {canApprove && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {contract.revenue.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No revenue entries yet.
                </TableCell>
              </TableRow>
            ) : (
              contract.revenue.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.description}</TableCell>
                  <TableCell>{formatCurrency(r.amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.status}</Badge>
                  </TableCell>
                  <TableCell>{r.approvalStatus}</TableCell>
                  {canApprove && r.approvalStatus === 'pending' && (
                    <TableCell>
                      <Button size="sm" onClick={() => approveRevenueMutation.mutate(r.id)}>
                        Approve
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Receipt className="h-5 w-5" />
            Billing Tracking
          </h2>
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const desc = prompt('Billing description');
                const amt = prompt('Amount (₹)');
                if (desc && amt) billingMutation.mutate({ description: desc, amount: Number(amt) });
              }}
            >
              Add Billing
            </Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approval</TableHead>
              {canApprove && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {contract.billing.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No billing records yet.
                </TableCell>
              </TableRow>
            ) : (
              contract.billing.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.description}</TableCell>
                  <TableCell>{formatCurrency(b.amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{b.status}</Badge>
                  </TableCell>
                  <TableCell>{b.approvalStatus}</TableCell>
                  {canApprove && b.approvalStatus === 'pending' && (
                    <TableCell>
                      <Button size="sm" onClick={() => approveBillingMutation.mutate(b.id)}>
                        Approve
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <FileText className="h-5 w-5" />
          Documents
        </h2>
        {contract.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded.</p>
        ) : (
          <ul className="space-y-2">
            {contract.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                <span>
                  {d.documentType.replace('_', ' ')} — {d.originalName}
                  {d.documentNumber && ` (${d.documentNumber})`}
                </span>
                <span className="text-muted-foreground">{formatDate(d.uploadedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {contract.activityLog.length > 0 && (
        <section className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
          <h2 className="mb-3 text-lg font-semibold">Activity History</h2>
          <ul className="space-y-2">
            {contract.activityLog.map((entry) => (
              <li key={entry.id} className="border-l-2 border-emerald-300 pl-3 text-sm">
                <p className="font-medium">{entry.message}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.userName} · {formatDate(entry.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
