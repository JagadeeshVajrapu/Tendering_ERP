'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/lib/utils';
import { Clock, CheckCircle, XCircle, FileText, User, Scale } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorState, LoadingState, StatCardSkeleton } from '@/components/shared/QueryState';
import { useState } from 'react';
import Link from 'next/link';
import type { MdApprovalRecord } from '@/types';

export default function MdDashboard() {
  const { token } = useAuthStore();
  const qc = useQueryClient();
  const [comments, setComments] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'md'],
    queryFn: () => api.getMdDashboard(token!),
    enabled: !!token,
    refetchInterval: 15000,
  });

  const decide = useMutation({
    mutationFn: ({ tenderId, decision }: { tenderId: string; decision: 'APPROVED' | 'REJECTED' }) =>
      api.mdTenderDecision(token!, tenderId, decision, comments[tenderId]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'md'] }),
  });

  const dashboard = data?.data;
  const pending = (dashboard?.pending as MdApprovalRecord[]) || [];
  const history = (dashboard?.history as MdApprovalRecord[]) || [];

  const historyColumns = [
    {
      key: 'tender',
      header: 'Tender',
      render: (row: MdApprovalRecord) => (
        <div>
          <p className="font-medium">{row.tenderId?.title || '—'}</p>
          <p className="text-xs text-muted-foreground">{row.tenderId?.tenderNumber}</p>
        </div>
      ),
    },
    {
      key: 'executive',
      header: 'Submitted By',
      render: (row: MdApprovalRecord) => (
        <div>
          <p className="font-medium">{row.requestedBy?.name || row.tenderId?.createdBy?.name || '—'}</p>
          <p className="text-xs text-muted-foreground">{row.requestedBy?.email}</p>
        </div>
      ),
    },
    {
      key: 'report',
      header: 'Feasibility Report',
      render: (row: MdApprovalRecord) =>
        row.feasibilityReport ? (
          <span className="text-sm text-green-700">{row.feasibilityReport.recommendation}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: 'decision',
      header: 'Decision',
      render: (row: MdApprovalRecord) => <StatusBadge status={row.decision} />,
    },
    {
      key: 'reviewed',
      header: 'Reviewed By',
      render: (row: MdApprovalRecord) => row.reviewedBy?.name || '—',
    },
    {
      key: 'date',
      header: 'Date',
      render: (row: MdApprovalRecord) => formatDate(row.decidedAt || row.createdAt),
    },
    {
      key: 'action',
      header: '',
      render: (row: MdApprovalRecord) =>
        row.tenderId?._id ? (
          <Link href={`/tenders/${row.tenderId._id}/report`}>
            <Button variant="ghost" size="sm">
              <FileText className="mr-1 h-3 w-3" /> View
            </Button>
          </Link>
        ) : null,
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Feasibility Review Desk"
        description="Review executive feasibility reports and record MD decisions."
        icon={Scale}
        iconClassName="text-indigo-600"
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <StatCardSkeleton count={4} />
      ) : (
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <StatCard title="Pending Review" value={pending.length} icon={Clock} />
          <StatCard title="Approved" value={(dashboard?.approved as number) || 0} icon={CheckCircle} />
          <StatCard title="Rejected" value={(dashboard?.rejected as number) || 0} icon={XCircle} />
          <StatCard title="Total Submitted" value={(dashboard?.totalSubmitted as number) || 0} icon={FileText} />
        </div>
      )}

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">Decision History ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6 space-y-4">
          {isLoading && <LoadingState message="Loading pending reviews…" />}
          {!isLoading && pending.map((approval) => {
            const tender = approval.tenderId;
            if (!tender) return null;
            const executive = approval.requestedBy || tender.createdBy;
            return (
              <Card key={approval._id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{tender.title}</CardTitle>
                      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>
                          {executive?.name}
                          {executive?.department ? ` · ${executive.department}` : ''}
                        </span>
                      </div>
                      {approval.feasibilityReport && (
                        <p className="mt-2 text-sm">
                          AI Recommendation:{' '}
                          <strong>{approval.feasibilityReport.recommendation}</strong>
                        </p>
                      )}
                    </div>
                    <Link href={`/tenders/${tender._id}/report`}>
                      <Button variant="outline" size="sm">
                        <FileText className="mr-2 h-4 w-4" /> View Feasibility Report
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <Input
                    placeholder="Remarks (optional)"
                    value={comments[tender._id] || ''}
                    onChange={(e) => setComments({ ...comments, [tender._id]: e.target.value })}
                  />
                  <div className="mt-4 flex gap-3">
                    <Button
                      onClick={() => decide.mutate({ tenderId: tender._id, decision: 'APPROVED' })}
                      disabled={decide.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => decide.mutate({ tenderId: tender._id, decision: 'REJECTED' })}
                      disabled={decide.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {pending.length === 0 && !isLoading && (
            <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
              No feasibility reports awaiting your review
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <DataTable columns={historyColumns} data={history} emptyMessage="No decision history yet" />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
