'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorState, ListSkeleton, StatCardSkeleton } from '@/components/shared/QueryState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getTenderDisplayLabel, statusColor } from '@/lib/tenderStatus';
import { FileText, Clock, CheckCircle, XCircle, IndianRupee, Rocket, Plus, LayoutDashboard } from 'lucide-react';
import type { Tender, FinanceRequestRecord } from '@/types';

export default function ExecutiveDashboard() {
  const { token } = useAuthStore();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'executive'],
    queryFn: () => api.getDashboardStats(token!),
    enabled: !!token,
  });

  const { data: financeData, isLoading: financeLoading } = useQuery({
    queryKey: ['executive-finance'],
    queryFn: () => api.getFinanceRequests(token!),
    enabled: !!token,
  });

  const stats = data?.data;
  const myPayments = (financeData?.data || []).filter((r) => r.utrNumber || r.transactionId).slice(0, 5);
  const recent = (stats?.recentActivities as Tender[]) || [];

  return (
    <DashboardLayout>
      <PageHeader
        title="Executive Dashboard"
        description="Manage tenders, AI analysis, submissions, and track approvals."
        icon={LayoutDashboard}
        actions={
          <Link href="/tenders/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Tender
            </Button>
          </Link>
        }
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <StatCardSkeleton count={6} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard title="Total Tenders" value={(stats?.totalTenders as number) || 0} icon={FileText} />
          <StatCard title="Pending Approval" value={(stats?.pendingApproval as number) || 0} icon={Clock} />
          <StatCard title="Approved" value={(stats?.approved as number) || 0} icon={CheckCircle} />
          <StatCard title="Rejected" value={(stats?.rejected as number) || 0} icon={XCircle} />
          <StatCard title="Finance Pending" value={(stats?.financePending as number) || 0} icon={IndianRupee} />
          <StatCard title="Ready for Bid" value={(stats?.readyForBid as number) || 0} icon={Rocket} />
        </div>
      )}

      <Card className="mt-8 border-slate-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Recent Tenders</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ListSkeleton rows={4} />
          ) : recent.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No tenders yet.{' '}
              <Link href="/tenders/new" className="font-medium text-blue-600 hover:underline">
                Create your first tender
              </Link>
            </p>
          ) : (
            <div className="space-y-2">
              {recent.map((tender) => (
                <Link
                  key={tender._id}
                  href={`/tenders/${tender._id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-4 transition-colors hover:border-blue-100 hover:bg-blue-50/40"
                >
                  <div className="min-w-0 pr-4">
                    <p className="truncate font-medium">{tender.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {tender.authority || tender.tenderNumber}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusColor(tender.status)}`}>
                    {getTenderDisplayLabel(tender.status, tender.currentStage)}
                  </span>
                    <p className="mt-1 text-sm font-medium">{formatCurrency(tender.estimatedValue)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {financeLoading ? null : myPayments.length > 0 && (
        <Card className="mt-8 border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myPayments.map((req: FinanceRequestRecord) => (
              <Link
                key={req._id}
                href={`/tenders/${typeof req.tenderId === 'object' ? req.tenderId?._id : req.tenderId}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 p-4 transition-colors hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium">{req.tenderId?.title || 'Tender'}</p>
                  <p className="text-sm text-muted-foreground">
                    {req.requestType} · {formatCurrency(req.amount)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-emerald-700">
                    UTR: {req.utrNumber || req.transactionId}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(req.paidAt || req.decidedAt)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
