'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  FileText,
  IndianRupee,
  Loader2,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { formatDate } from '@/lib/utils';
import { ErrorState, LoadingState } from '@/components/shared/QueryState';
import type { AdminDashboard } from '@/types/adminDashboard';

function formatCrore(amount: number): string {
  if (!amount) return '₹0';
  return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
}

function formatLakh(amount: number): string {
  if (!amount) return '₹0';
  return `₹${(amount / 1_00_000).toFixed(2)} L`;
}

function priorityClass(p: string) {
  const map: Record<string, string> = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-900',
    medium: 'bg-amber-100 text-amber-900',
    low: 'bg-slate-100 text-slate-700',
  };
  return map[p] || map.low;
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent || 'text-slate-900 dark:text-white'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Icon className="h-4 w-4 text-violet-600" />
          {title}
        </h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

interface Props {
  token: string;
}

export function AdminDashboardView({ token }: Props) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.getAdminDashboard(token),
    enabled: !!token,
    staleTime: 45_000,
  });

  const dashboard: AdminDashboard | null = data?.data ?? null;

  if (isLoading) {
    return <LoadingState message="Loading management control center…" />;
  }

  if (isError || !dashboard) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  const t = dashboard.tenderOverview;
  const f = dashboard.financialOverview;
  const r = dashboard.revenueBilling;
  const c = dashboard.contractOverview;

  const quickLinks = [
    { href: '/tenders', label: 'All Tenders', icon: FileText },
    { href: '/awarded-contracts', label: 'Contracts', icon: Building2 },
    { href: '/management-reports', label: 'MIS Reports', icon: TrendingUp },
    { href: '/dashboard/admin/users', label: 'User Management', icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950 px-6 py-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Shield className="h-5 w-5 text-violet-300" />
              <span className="text-xs font-semibold uppercase tracking-widest text-violet-300">
                Management Control Center
              </span>
            </div>
            <h2 className="text-2xl font-bold">Organization Overview</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-300">
              Complete visibility into tenders, finance, contracts, revenue, and team performance.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="bg-white/10 text-white hover:bg-white/20"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <div className="relative z-10 mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition-colors hover:bg-white/10"
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-violet-300" />
                  {link.label}
                </span>
                <ArrowRight className="h-4 w-4 opacity-60" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tender Overview KPIs */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-400">Tender Overview</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <KpiCard label="Total Tenders" value={t.totalTenders} />
          <KpiCard label="Active" value={t.activeTenders} accent="text-blue-600" />
          <KpiCard label="Submitted" value={t.submittedTenders} accent="text-violet-600" />
          <KpiCard label="Awarded" value={t.awardedTenders} accent="text-emerald-600" />
          <KpiCard label="Lost" value={t.lostTenders} accent="text-red-600" />
          <KpiCard label="Tender Value" value={formatCrore(t.totalTenderValue)} />
          <KpiCard label="Win Rate" value={`${t.winRatePercent}%`} sub="Participated basis" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Executive Performance */}
        <Section title="Executive Performance" icon={Users}>
          {dashboard.executivePerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No executives found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Executive</TableHead>
                    <TableHead className="text-right">Assigned</TableHead>
                    <TableHead className="text-right">Submitted</TableHead>
                    <TableHead className="text-right">Awarded</TableHead>
                    <TableHead className="text-right">Win %</TableHead>
                    <TableHead className="text-right">Tasks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.executivePerformance.map((exec) => (
                    <TableRow key={exec.executiveId}>
                      <TableCell>
                        <div className="font-medium">{exec.executiveName}</div>
                        <div className="text-xs text-muted-foreground">{exec.email}</div>
                      </TableCell>
                      <TableCell className="text-right">{exec.assignedTenders}</TableCell>
                      <TableCell className="text-right">{exec.submittedTenders}</TableCell>
                      <TableCell className="text-right">{exec.awardedTenders}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700">
                        {exec.winRatePercent}%
                      </TableCell>
                      <TableCell className="text-right">
                        {exec.pendingTasks > 0 ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800">
                            {exec.pendingTasks}
                          </Badge>
                        ) : (
                          '0'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>

        {/* Critical Alerts */}
        <Section
          title="Critical Alerts"
          icon={AlertTriangle}
          action={
            dashboard.criticalAlerts.length > 0 && (
              <Badge className="bg-red-100 text-red-800">
                {dashboard.criticalAlerts.filter((a) => a.priority === 'critical').length} critical
              </Badge>
            )
          }
        >
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {dashboard.criticalAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No critical alerts at this time.</p>
            ) : (
              dashboard.criticalAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-lg border border-slate-100 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <Badge className={priorityClass(alert.priority)}>{alert.priority}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{alert.module}</span>
                    {alert.tenderId && (
                      <Link
                        href={`/tenders/${alert.tenderId}`}
                        className="text-xs font-medium text-violet-600 hover:underline"
                      >
                        View tender
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Section>
      </div>

      {/* Financial + Revenue + Contracts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Financial Overview" icon={Wallet}>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="EMD Locked" value={formatLakh(f.emdLocked)} />
            <KpiCard label="EMD Refunded" value={formatLakh(f.emdRefunded)} />
            <KpiCard label="Pending Refund" value={formatLakh(f.pendingRefundAmount)} />
            <KpiCard label="Active BG" value={formatLakh(f.activeBg)} />
            <KpiCard label="Pending BG" value={formatLakh(f.pendingBg)} />
            <KpiCard label="Expired BG" value={formatLakh(f.expiredBg)} />
            <KpiCard label="Tender Fees Paid" value={formatLakh(f.tenderFeesPaid)} />
            <KpiCard label="Security Deposits" value={formatLakh(f.securityDeposits)} />
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">PBG Status</p>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="font-bold text-emerald-700">{formatLakh(f.pbgActive)}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div>
                <p className="font-bold text-amber-700">{formatLakh(f.pbgPending)}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div>
                <p className="font-bold text-red-700">{formatLakh(f.pbgExpired)}</p>
                <p className="text-xs text-muted-foreground">Expired</p>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Revenue & Billing" icon={IndianRupee}>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Contract Value" value={formatCrore(r.totalContractValue)} />
            <KpiCard label="Received" value={formatCrore(r.revenueReceived)} accent="text-emerald-600" />
            <KpiCard label="Pending" value={formatCrore(r.revenuePending)} accent="text-amber-600" />
            <KpiCard label="Pending Billing" value={formatCrore(r.pendingBilling)} />
            <KpiCard label="Paid Invoices" value={r.paidInvoices} />
            <KpiCard label="Unpaid Invoices" value={r.unpaidInvoices} accent="text-red-600" />
          </div>
        </Section>

        <Section title="Contract Overview" icon={Building2}>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Running" value={c.runningContracts} accent="text-emerald-600" />
            <KpiCard label="Completed" value={c.completedContracts} />
            <KpiCard label="Expiring Soon" value={c.contractsExpiringSoon} accent="text-amber-600" />
            <KpiCard label="AMC Expiring" value={c.amcExpiringSoon} accent="text-orange-600" />
            <KpiCard label="Agreements Expiring" value={c.agreementsExpiringSoon} accent="text-red-600" />
          </div>
          <Link
            href="/awarded-contracts"
            className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50 dark:border-slate-700 dark:hover:bg-violet-950/30"
          >
            View all contracts <ArrowRight className="h-4 w-4" />
          </Link>
        </Section>
      </div>

      {/* Recent Activity */}
      <Section title="Recent Activity" icon={Activity}>
        {dashboard.recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>When</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.recentActivity.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.user}</TableCell>
                  <TableCell>{item.action}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.module}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(item.timestamp)}</TableCell>
                  <TableCell>
                    {item.tenderId && (
                      <Link
                        href={`/tenders/${item.tenderId}`}
                        className="text-sm text-violet-600 hover:underline"
                      >
                        Open
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <p className="text-center text-xs text-muted-foreground">
        Last updated {formatDate(dashboard.generatedAt)}
      </p>
    </div>
  );
}
