'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { statusColor, formatCurrency, formatDate } from '@/lib/utils';
import { FileText, Clock, CheckCircle, XCircle, IndianRupee, Rocket, Plus } from 'lucide-react';
import type { Tender, FinanceRequestRecord } from '@/types';

export default function ExecutiveDashboard() {
  const { token } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'executive'],
    queryFn: () => api.getDashboardStats(token!),
    enabled: !!token,
  });

  const { data: financeData } = useQuery({
    queryKey: ['executive-finance'],
    queryFn: () => api.getFinanceRequests(token!),
    enabled: !!token,
  });

  const stats = data?.data;
  const myPayments = (financeData?.data || []).filter((r) => r.utrNumber || r.transactionId).slice(0, 5);

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Executive Dashboard</h1>
          <p className="text-muted-foreground">Manage tenders, AI analysis, and approvals</p>
        </div>
        <Link href="/tenders/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Tender
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard title="Total Tenders" value={stats?.totalTenders as number || 0} icon={FileText} />
          <StatCard title="Pending Approval" value={stats?.pendingApproval as number || 0} icon={Clock} />
          <StatCard title="Approved" value={stats?.approved as number || 0} icon={CheckCircle} />
          <StatCard title="Rejected" value={stats?.rejected as number || 0} icon={XCircle} />
          <StatCard title="Finance Pending" value={stats?.financePending as number || 0} icon={IndianRupee} />
          <StatCard title="Ready for Bid" value={stats?.readyForBid as number || 0} icon={Rocket} />
        </div>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {((stats?.recentActivities as Tender[]) || []).map((tender) => (
              <Link
                key={tender._id}
                href={`/tenders/${tender._id}`}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium">{tender.title}</p>
                  <p className="text-sm text-muted-foreground">{tender.authority || tender.tenderNumber}</p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColor(tender.status)}`}>
                    {tender.currentStage}
                  </span>
                  <p className="mt-1 text-sm">{formatCurrency(tender.estimatedValue)}</p>
                </div>
              </Link>
            ))}
            {(!stats?.recentActivities || (stats.recentActivities as Tender[]).length === 0) && (
              <p className="py-8 text-center text-muted-foreground">No tenders yet. Create your first tender.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {myPayments.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myPayments.map((req: FinanceRequestRecord) => (
              <Link
                key={req._id}
                href={`/tenders/${typeof req.tenderId === 'object' ? req.tenderId?._id : req.tenderId}`}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium">{req.tenderId?.title || 'Tender'}</p>
                  <p className="text-sm text-muted-foreground">
                    {req.requestType} · {formatCurrency(req.amount)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-green-700">
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
