'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Loader2, Plus, Send } from 'lucide-react';
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
import { REQUEST_TYPE_LABELS } from '@/types/financeWorkflow';
import type { FinanceWorkflowRequestType } from '@/types/financeWorkflow';

const PAYMENT_REQUEST_TYPES: FinanceWorkflowRequestType[] = [
  'EMD_REQUEST',
  'BG_REQUEST',
  'DD_REQUEST',
  'TENDER_FEE_PAYMENT',
  'SECURITY_DEPOSIT_PAYMENT',
  'PBG_REQUEST',
];

interface Props {
  token: string;
  tenderId: string;
  canEdit: boolean;
}

export function FinanceWorkflowSection({ token, tenderId, canEdit }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [requestType, setRequestType] = useState<FinanceWorkflowRequestType>('EMD_REQUEST');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [refundType, setRefundType] = useState<'REFUND_EMD' | 'REFUND_SECURITY_DEPOSIT' | 'PBG_RELEASE'>(
    'REFUND_EMD'
  );
  const [mode, setMode] = useState<'payment' | 'refund'>('payment');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tender-finance-requests', tenderId],
    queryFn: () => api.listTenderFinanceRequests(token, tenderId),
    enabled: !!token,
  });

  const requests = data?.data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: () => {
      if (mode === 'refund') {
        return api.createTenderRefundRequest(token, tenderId, {
          refundType,
          amount: Number(amount),
          remarks: remarks || undefined,
          submit: true,
        });
      }
      return api.createTenderFinanceRequest(token, tenderId, {
        requestType,
        amount: Number(amount),
        remarks: remarks || undefined,
        submit: true,
      });
    },
    onSuccess: () => {
      setShowForm(false);
      setAmount('');
      setRemarks('');
      setMessage('Request submitted for approval');
      setError('');
      void queryClient.invalidateQueries({ queryKey: ['tender-finance-requests', tenderId] });
      void queryClient.invalidateQueries({ queryKey: ['finance-tracking', tenderId] });
      void queryClient.invalidateQueries({ queryKey: ['finance-approval-dashboard'] });
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, 'Failed to submit request')),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.syncTenderFinanceWorkflow(token, tenderId),
    onSuccess: () => {
      setMessage('Workflow synced — renewal requests and tasks updated');
      void queryClient.invalidateQueries({ queryKey: ['finance-approval-dashboard'] });
    },
    onError: (err) => setError(getErrorMessage(err, 'Sync failed')),
  });

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Approvals & Requests</h2>
          <p className="text-xs text-muted-foreground">
            Executive → Finance → Manager approval workflow
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/finance-approvals">
            <Button variant="outline" size="sm">
              Finance Approval Dashboard
            </Button>
          </Link>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
                {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sync renewals & tasks'}
              </Button>
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New request
              </Button>
            </>
          )}
        </div>
      </div>

      {(message || error) && (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {error || message}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No approval requests for this tender yet.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-xs">{req.requestNumber}</TableCell>
                    <TableCell>{REQUEST_TYPE_LABELS[req.requestType]}</TableCell>
                    <TableCell>{formatCurrency(req.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{req.displayStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(req.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Submit finance request</h3>
            <div className="mb-3 flex gap-2">
              <Button
                size="sm"
                variant={mode === 'payment' ? 'default' : 'outline'}
                onClick={() => setMode('payment')}
              >
                Payment
              </Button>
              <Button
                size="sm"
                variant={mode === 'refund' ? 'default' : 'outline'}
                onClick={() => setMode('refund')}
              >
                Refund
              </Button>
            </div>
            {mode === 'payment' ? (
              <select
                className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as FinanceWorkflowRequestType)}
              >
                {PAYMENT_REQUEST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {REQUEST_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
                value={refundType}
                onChange={(e) =>
                  setRefundType(e.target.value as 'REFUND_EMD' | 'REFUND_SECURITY_DEPOSIT' | 'PBG_RELEASE')
                }
              >
                <option value="REFUND_EMD">EMD Refund</option>
                <option value="REFUND_SECURITY_DEPOSIT">Security Deposit Refund</option>
                <option value="PBG_RELEASE">PBG Release</option>
              </select>
            )}
            <Input
              type="number"
              className="mb-3"
              placeholder="Amount (₹)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input
              className="mb-4"
              placeholder="Remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                disabled={!amount || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Submit for approval
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
