'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  IndianRupee,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import type { FinanceWorkflowRequest } from '@/types/financeWorkflow';
import { REQUEST_TYPE_LABELS } from '@/types/financeWorkflow';

interface Props {
  token: string;
  canApprove: boolean;
}

function statusBadge(status: string) {
  if (status === 'approved' || status === 'completed') return 'bg-emerald-100 text-emerald-800';
  if (status === 'rejected') return 'bg-red-100 text-red-800';
  if (status.includes('pending')) return 'bg-amber-100 text-amber-900';
  return 'bg-slate-100 text-slate-700';
}

export function FinanceApprovalDashboard({ token, canApprove }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [commentRequestId, setCommentRequestId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveComment, setApproveComment] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['finance-approval-dashboard'],
    queryFn: () => api.getFinanceApprovalDashboard(token),
    enabled: !!token,
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const dashboard = data?.data;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['finance-approval-dashboard'] });
  };

  const approveMutation = useMutation({
    mutationFn: (requestId: string) =>
      api.approveFinanceWorkflowRequest(token, requestId, { comments: approveComment || undefined }),
    onSuccess: () => {
      setApproveComment('');
      setCommentRequestId(null);
      setMessage('Request approved');
      setError('');
      invalidate();
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, 'Approval failed')),
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) =>
      api.rejectFinanceWorkflowRequest(token, requestId, { rejectionReason: rejectReason }),
    onSuccess: () => {
      setRejectId(null);
      setRejectReason('');
      setMessage('Request rejected');
      setError('');
      invalidate();
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, 'Rejection failed')),
  });

  const taskMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: 'in_progress' | 'completed' }) =>
      api.updateFinanceTaskStatus(token, taskId, status),
    onSuccess: () => {
      invalidate();
      void refetch();
    },
  });

  const filterRequests = (items: FinanceWorkflowRequest[]) => {
    if (!search.trim()) return items;
    const term = search.toLowerCase();
    return items.filter(
      (r) =>
        r.requestNumber.toLowerCase().includes(term) ||
        r.tenderName?.toLowerCase().includes(term) ||
        r.requestedByName?.toLowerCase().includes(term) ||
        REQUEST_TYPE_LABELS[r.requestType]?.toLowerCase().includes(term)
    );
  };

  const RequestTable = ({
    items,
    showActions = false,
  }: {
    items: FinanceWorkflowRequest[];
    showActions?: boolean;
  }) => (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Request #</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Tender</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Requested By</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            {showActions && canApprove && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showActions && canApprove ? 8 : 7} className="py-8 text-center text-muted-foreground">
                No requests found.
              </TableCell>
            </TableRow>
          ) : (
            items.map((req) => (
              <TableRow key={req.id}>
                <TableCell className="font-mono text-xs">{req.requestNumber}</TableCell>
                <TableCell>{REQUEST_TYPE_LABELS[req.requestType]}</TableCell>
                <TableCell>
                  <Link href={`/tenders/${req.tenderId}/finance-tracking`} className="text-blue-700 hover:underline">
                    {req.tenderName || req.tenderId.slice(-6)}
                  </Link>
                </TableCell>
                <TableCell>{formatCurrency(req.amount)}</TableCell>
                <TableCell>{req.requestedByName || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(req.createdAt)}</TableCell>
                <TableCell>
                  <Badge className={statusBadge(req.status)}>{req.displayStatus}</Badge>
                </TableCell>
                {showActions && canApprove && (
                  <TableCell className="text-right">
                    {(req.status === 'pending_finance' || req.status === 'pending_manager') && (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate(req.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => setRejectId(req.id)}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-20 text-muted-foreground">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-600" />
        Loading finance approval dashboard…
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        Unable to load finance approval dashboard.
      </div>
    );
  }

  const widgets = [
    { label: 'Pending Approvals', value: dashboard.widgets.totalPendingApprovals, icon: Clock },
    { label: 'Approved Requests', value: dashboard.widgets.totalApprovedRequests, icon: CheckCircle2 },
    { label: 'Pending Refunds', value: dashboard.widgets.totalPendingRefunds, icon: IndianRupee },
    { label: 'BG Expiring Soon', value: dashboard.widgets.bgExpiringSoon, icon: AlertTriangle },
    { label: 'PBG Expiring Soon', value: dashboard.widgets.pbgExpiringSoon, icon: AlertTriangle },
    { label: 'Finance Tasks', value: dashboard.widgets.totalFinanceTasks, icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search requests, tenders, requesters…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {(message || error) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {widgets.map((w) => {
          const Icon = w.icon;
          return (
            <div key={w.label} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{w.label}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{w.value}</p>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="pending">Pending Approvals</TabsTrigger>
          <TabsTrigger value="refunds">Refund Requests</TabsTrigger>
          <TabsTrigger value="bg">BG Renewals</TabsTrigger>
          <TabsTrigger value="pbg">PBG Renewals</TabsTrigger>
          <TabsTrigger value="tasks">Finance Tasks</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Awaiting decision</h3>
            <RequestTable items={filterRequests(dashboard.pendingApprovals)} showActions />
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Approved</h3>
            <RequestTable items={filterRequests(dashboard.approvedRequests)} />
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Rejected</h3>
            <RequestTable items={filterRequests(dashboard.rejectedRequests)} />
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Completed</h3>
            <RequestTable items={filterRequests(dashboard.completedRequests)} />
          </section>
        </TabsContent>

        <TabsContent value="refunds" className="mt-4">
          <RequestTable items={filterRequests(dashboard.refundRequests)} showActions />
        </TabsContent>

        <TabsContent value="bg" className="mt-4">
          <RequestTable items={filterRequests(dashboard.bgRenewals)} showActions />
        </TabsContent>

        <TabsContent value="pbg" className="mt-4">
          <RequestTable items={filterRequests(dashboard.pbgRenewals)} showActions />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Tender</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No open finance tasks.
                    </TableCell>
                  </TableRow>
                ) : (
                  dashboard.tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <p className="font-medium">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground">{task.description}</p>
                        )}
                      </TableCell>
                      <TableCell>{task.tenderName || task.tenderId.slice(-6)}</TableCell>
                      <TableCell>{task.assignedToName || 'Unassigned'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{task.status.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {task.status !== 'completed' && (
                          <div className="flex justify-end gap-1">
                            {task.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  taskMutation.mutate({ taskId: task.id, status: 'in_progress' })
                                }
                              >
                                Start
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => taskMutation.mutate({ taskId: task.id, status: 'completed' })}
                            >
                              Complete
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <ul className="space-y-2">
            {dashboard.notifications.length === 0 ? (
              <li className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                No finance notifications.
              </li>
            ) : (
              dashboard.notifications.map((n) => (
                <li key={n.id} className="flex gap-3 rounded-lg border bg-white p-4">
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <div>
                    <p className="font-medium text-slate-900">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <ul className="space-y-2">
            {dashboard.auditLogs.length === 0 ? (
              <li className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                No audit entries yet.
              </li>
            ) : (
              dashboard.auditLogs.map((entry) => (
                <li key={entry.id} className="rounded-lg border-l-2 border-emerald-300 bg-white px-4 py-3">
                  <p className="text-sm font-medium">{entry.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.userName} · {entry.action} · {formatDate(entry.createdAt)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </TabsContent>
      </Tabs>

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <XCircle className="h-5 w-5 text-red-600" />
              Reject request
            </h3>
            <Input
              placeholder="Rejection reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectId(null)}>
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate(rejectId)}
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
