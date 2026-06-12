'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Clock, CheckCircle, IndianRupee, Receipt } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorState, LoadingState, StatCardSkeleton } from '@/components/shared/QueryState';
import { useState } from 'react';
import type { FinanceRequestRecord } from '@/types';

export default function FinanceDashboard() {
  const { token } = useAuthStore();
  const qc = useQueryClient();
  const [paymentForms, setPaymentForms] = useState<Record<string, { utrNumber: string; transactionId: string }>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'finance'],
    queryFn: () => api.getFinanceDashboard(token!),
    enabled: !!token,
    refetchInterval: 15000,
  });

  const decide = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      api.financeDecision(token!, id, approved),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'finance'] }),
  });

  const recordPayment = useMutation({
    mutationFn: (id: string) =>
      api.recordFinancePayment(token!, id, paymentForms[id] || {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'finance'] }),
  });

  const dashboard = data?.data;
  const pending = (dashboard?.pending as FinanceRequestRecord[]) || [];
  const approved = (dashboard?.approved as FinanceRequestRecord[]) || [];
  const paidHistory = (dashboard?.paidHistory as FinanceRequestRecord[]) || [];
  const stats = dashboard?.stats as Record<string, number> | undefined;

  const paidColumns = [
    {
      key: 'tender',
      header: 'Tender',
      render: (row: FinanceRequestRecord) => row.tenderId?.title || '—',
    },
    {
      key: 'executive',
      header: 'Executive',
      render: (row: FinanceRequestRecord) => (
        <div>
          <p className="font-medium">{row.requestedBy?.name || '—'}</p>
          <p className="text-xs text-muted-foreground">{row.requestedBy?.email}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row: FinanceRequestRecord) => row.requestType,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row: FinanceRequestRecord) => formatCurrency(row.amount),
    },
    {
      key: 'utr',
      header: 'UTR / Transaction ID',
      render: (row: FinanceRequestRecord) => (
        <span className="font-mono text-sm">{row.utrNumber || row.transactionId || '—'}</span>
      ),
    },
    {
      key: 'paidAt',
      header: 'Paid On',
      render: (row: FinanceRequestRecord) => formatDate(row.paidAt || row.decidedAt),
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Finance Desk"
        description="Approve EMD/BG requests and record payment details."
        icon={IndianRupee}
        iconClassName="text-emerald-600"
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <StatCardSkeleton count={4} />
      ) : (
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <StatCard title="Pending" value={stats?.pendingCount ?? pending.length} icon={Clock} />
          <StatCard title="Approved" value={stats?.approvedCount ?? approved.length} icon={CheckCircle} />
          <StatCard title="Paid" value={stats?.paidCount ?? paidHistory.length} icon={Receipt} />
          <StatCard title="Total Paid" value={formatCurrency(stats?.totalAmountPaid ?? 0)} icon={IndianRupee} />
        </div>
      )}

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Awaiting Payment ({approved.filter((r) => !r.utrNumber && !r.transactionId).length})</TabsTrigger>
          <TabsTrigger value="paid">Payment History ({paidHistory.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6 space-y-4">
          {isLoading && <LoadingState message="Loading finance requests…" />}
          {!isLoading && pending.map((req) => (
            <Card key={req._id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
                <div>
                  <p className="text-lg font-semibold">
                    {req.requestType} — {formatCurrency(req.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {req.tenderId?.title} · Requested by <strong>{req.requestedBy?.name}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(req.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide.mutate({ id: req._id, approved: true })} disabled={decide.isPending}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => decide.mutate({ id: req._id, approved: false })} disabled={decide.isPending}>Reject</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {pending.length === 0 && !isLoading && (
            <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">No pending finance requests</div>
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-6 space-y-4">
          {approved.filter((r) => !r.utrNumber && !r.transactionId).map((req) => (
            <Card key={req._id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {req.requestType} — {formatCurrency(req.amount)} · {req.tenderId?.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">Executive: {req.requestedBy?.name}</p>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`utr-${req._id}`}>UTR Number</Label>
                  <Input
                    id={`utr-${req._id}`}
                    placeholder="e.g. 123456789012"
                    value={paymentForms[req._id]?.utrNumber || ''}
                    onChange={(e) =>
                      setPaymentForms({ ...paymentForms, [req._id]: { ...paymentForms[req._id], utrNumber: e.target.value, transactionId: paymentForms[req._id]?.transactionId || '' } })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor={`txn-${req._id}`}>Transaction ID</Label>
                  <Input
                    id={`txn-${req._id}`}
                    placeholder="Bank reference / txn id"
                    value={paymentForms[req._id]?.transactionId || ''}
                    onChange={(e) =>
                      setPaymentForms({ ...paymentForms, [req._id]: { utrNumber: paymentForms[req._id]?.utrNumber || '', transactionId: e.target.value } })
                    }
                  />
                </div>
                <Button
                  className="sm:col-span-2"
                  onClick={() => recordPayment.mutate(req._id)}
                  disabled={recordPayment.isPending || (!paymentForms[req._id]?.utrNumber && !paymentForms[req._id]?.transactionId)}
                >
                  Record Payment
                </Button>
              </CardContent>
            </Card>
          ))}
          {approved.filter((r) => !r.utrNumber && !r.transactionId).length === 0 && (
            <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">All approved requests have payment recorded</div>
          )}
        </TabsContent>

        <TabsContent value="paid" className="mt-6">
          <DataTable columns={paidColumns} data={paidHistory} emptyMessage="No payments recorded yet" />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
