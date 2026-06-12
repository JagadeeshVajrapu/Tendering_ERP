'use client';

import { useMemo, useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ErrorState, LoadingState } from '@/components/shared/QueryState';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  IndianRupee,
  Loader2,
  PieChart,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
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
import { formatDate } from '@/lib/utils';
import type { MisDashboard, MisFilterQuery, MisSearchResult } from '@/types/misReporting';

function formatCrore(amount: number): string {
  if (!amount) return '₹0';
  return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
}

function formatLakh(amount: number): string {
  if (!amount) return '₹0';
  return `₹${(amount / 1_00_000).toFixed(2)} L`;
}

function priorityBadge(p: string) {
  const map: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-900 border-orange-200',
    medium: 'bg-amber-100 text-amber-900 border-amber-200',
    low: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return map[p] || map.low;
}

function SectionCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className || ''}`}
    >
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        <Icon className="h-4 w-4 text-indigo-600" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/50">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

interface Props {
  token: string;
}

export function MisDashboardView({ token }: Props) {
  const [filters, setFilters] = useState<MisFilterQuery>({});
  const debouncedFilters = useDebouncedValue(filters, 400);
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDebouncedValue(searchInput.trim(), 350);

  const { data, isLoading, isError, error, refetch, isFetching, isPlaceholderData } = useQuery({
    queryKey: ['mis-dashboard', debouncedFilters],
    queryFn: () => api.getMisDashboard(token, debouncedFilters),
    enabled: !!token,
    staleTime: 45_000,
    placeholderData: (prev) => prev,
  });

  const { data: searchData, isFetching: searchFetching } = useQuery({
    queryKey: ['mis-search', searchTerm, debouncedFilters],
    queryFn: () => api.getMisSearch(token, searchTerm, debouncedFilters),
    enabled: !!token && searchTerm.length >= 2,
  });

  const { data: activityData } = useQuery({
    queryKey: ['mis-recent-activity', debouncedFilters],
    queryFn: () => api.getMisRecentActivity(token, debouncedFilters, 25),
    enabled: !!token,
    staleTime: 45_000,
  });

  const dashboard: MisDashboard | null = data?.data ?? null;
  const searchResults: MisSearchResult[] = searchData?.data ?? [];

  const activityItems = useMemo(() => {
    if (activityData?.data?.length) return activityData.data;
    return [];
  }, [activityData]);

  if (isLoading && !dashboard) {
    return <LoadingState message="Loading management dashboard…" />;
  }

  if (isError || !dashboard) {
    return <ErrorState error={error} onRetry={() => refetch()} title="Unable to load MIS dashboard" />;
  }

  const s = dashboard.summary;
  const perms = dashboard.permissions;

  const summaryCards = [
    { label: 'Participated', value: s.participatedTenders },
    { label: 'Won', value: s.wonTenders },
    { label: 'Lost', value: s.lostTenders },
    { label: 'Win Rate', value: `${s.winRate}%` },
    { label: 'Tender Value', value: formatCrore(s.tenderValue) },
    { label: 'Running Contracts', value: s.runningContracts },
    { label: 'Expired Contracts', value: s.expiredContracts },
    { label: 'Expiring (30d)', value: s.expiringContracts },
    ...(perms.canViewFinance
      ? [
          { label: 'EMD Locked', value: formatLakh(s.emdLocked) },
          { label: 'Pending BG', value: formatLakh(s.pendingBg) },
        ]
      : []),
    ...(perms.canViewFinance || perms.canViewContracts
      ? [
          { label: 'Revenue Received', value: formatCrore(s.revenueReceived) },
          { label: 'Pending Revenue', value: formatCrore(s.pendingRevenue) },
          { label: 'Pending Billing', value: formatCrore(s.pendingBilling) },
        ]
      : []),
  ];

  const allAlerts = [
    ...dashboard.alerts.critical,
    ...dashboard.alerts.high,
    ...dashboard.alerts.medium,
    ...dashboard.alerts.low,
  ].slice(0, 12);

  return (
    <div className={`space-y-6 transition-opacity duration-200 ${isFetching || isPlaceholderData ? 'opacity-90' : ''}`}>
      {/* Header + Filters */}
      <div className="flex flex-col gap-4 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-slate-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-600">Executive Control Center</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Aggregated intelligence from submission, finance, and post-award modules
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
            placeholder="From date"
          />
          <Input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))}
            placeholder="To date"
          />
          <Input
            placeholder="Service category"
            value={filters.serviceCategory || ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, serviceCategory: e.target.value || undefined }))
            }
          />
          <Input
            placeholder="Client name"
            value={filters.clientName || ''}
            onChange={(e) => setFilters((f) => ({ ...f, clientName: e.target.value || undefined }))}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={filters.tenderStatus || ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, tenderStatus: e.target.value || undefined }))
            }
          >
            <option value="">All tender statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="AWARDED">Awarded</option>
            <option value="READY_FOR_BID">Ready for Bid</option>
          </select>
        </div>
      </div>

      {/* Executive Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Section 1: Tender Performance */}
        <SectionCard title="Tender Performance" icon={Target}>
          <div className="grid grid-cols-2 gap-3">
            <MetricTile label="Participated" value={dashboard.tenderPerformance.totalParticipated} />
            <MetricTile label="Won" value={dashboard.tenderPerformance.totalWon} />
            <MetricTile label="Lost" value={dashboard.tenderPerformance.totalLost} />
            <MetricTile label="Win Rate" value={`${dashboard.tenderPerformance.winRatePercent}%`} />
          </div>
        </SectionCard>

        {/* Section 2: Tender Value */}
        <SectionCard title="Tender Value" icon={IndianRupee}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricTile label="Total" value={formatCrore(dashboard.tenderValue.totalTenderValue)} />
            <MetricTile label="Awarded" value={formatCrore(dashboard.tenderValue.awardedTenderValue)} />
            <MetricTile label="Lost" value={formatCrore(dashboard.tenderValue.lostTenderValue)} />
          </div>
        </SectionCard>

        {/* Section 3: Service Category */}
        <SectionCard title="Service Category Report" icon={PieChart}>
          <div className="space-y-2">
            {dashboard.serviceCategory.categories.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">{cat.category}</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 rounded-full bg-indigo-500"
                    style={{
                      width: `${Math.max(8, dashboard.serviceCategory.total ? (cat.count / dashboard.serviceCategory.total) * 120 : 0)}px`,
                    }}
                  />
                  <span className="min-w-[2rem] text-right font-semibold">{cat.count}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Section 10: Quick Insights */}
        <SectionCard title="Quick Insights" icon={Sparkles}>
          <div className="space-y-3">
            {dashboard.quickInsights.map((insight) => (
              <div
                key={insight.key}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800"
              >
                <div>
                  <p className="text-sm font-medium">{insight.label}</p>
                  {insight.detail && (
                    <p className="text-xs text-muted-foreground">{insight.detail}</p>
                  )}
                </div>
                <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400">
                  {insight.value}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Finance + Contracts + Revenue */}
      <div className="grid gap-6 lg:grid-cols-3">
        {perms.canViewFinance && (
          <SectionCard title="Finance Dashboard" icon={Wallet}>
            <div className="grid grid-cols-2 gap-3">
              <MetricTile label="EMD Locked" value={formatLakh(dashboard.finance.emdLocked)} />
              <MetricTile label="EMD Refunded" value={formatLakh(dashboard.finance.emdRefunded)} />
              <MetricTile label="Pending Refund" value={formatLakh(dashboard.finance.pendingRefund)} />
              <MetricTile label="Received BG" value={formatLakh(dashboard.finance.receivedBg)} />
              <MetricTile label="Pending BG" value={formatLakh(dashboard.finance.pendingBg)} />
              <MetricTile label="Active BG" value={formatLakh(dashboard.finance.activeBg)} />
            </div>
          </SectionCard>
        )}

        {perms.canViewContracts && (
          <SectionCard title="Contract Dashboard" icon={Building2}>
            <div className="grid grid-cols-2 gap-3">
              <MetricTile label="Running" value={dashboard.contracts.runningContracts} />
              <MetricTile label="Completed" value={dashboard.contracts.completedContracts} />
              <MetricTile label="Expired" value={dashboard.contracts.expiredContracts} />
              <MetricTile label="Expiring 30d" value={dashboard.contracts.expiringIn30Days} />
              <MetricTile label="Expiring 60d" value={dashboard.contracts.expiringIn60Days} />
              <MetricTile label="Expiring 90d" value={dashboard.contracts.expiringIn90Days} />
            </div>
          </SectionCard>
        )}

        {(perms.canViewFinance || perms.canViewContracts) && (
          <SectionCard title="Revenue Dashboard" icon={TrendingUp}>
            <div className="grid grid-cols-2 gap-3">
              <MetricTile label="Contract Value" value={formatCrore(dashboard.revenue.contractValue)} />
              <MetricTile label="Received" value={formatCrore(dashboard.revenue.revenueReceived)} />
              <MetricTile label="Pending" value={formatCrore(dashboard.revenue.revenuePending)} />
              <MetricTile label="Pending Billing" value={formatCrore(dashboard.revenue.pendingBilling)} />
              <MetricTile label="Total Invoices" value={dashboard.revenue.totalInvoices} />
              <MetricTile label="Paid" value={dashboard.revenue.paidInvoices} />
              <MetricTile label="Pending Invoices" value={dashboard.revenue.pendingInvoices} />
            </div>
          </SectionCard>
        )}
      </div>

      {/* Alerts + Search */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Expiry & Alert Center" icon={AlertTriangle}>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge className={priorityBadge('critical')}>Critical: {dashboard.alerts.counts.critical}</Badge>
            <Badge className={priorityBadge('high')}>High: {dashboard.alerts.counts.high}</Badge>
            <Badge className={priorityBadge('medium')}>Medium: {dashboard.alerts.counts.medium}</Badge>
            <Badge className={priorityBadge('low')}>Low: {dashboard.alerts.counts.low}</Badge>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {allAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active alerts.</p>
            ) : (
              allAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-lg border border-slate-100 p-3 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <Badge variant="outline" className={priorityBadge(alert.priority)}>
                      {alert.priority}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {alert.module}
                    {alert.dueDate ? ` · Due ${formatDate(alert.dueDate)}` : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Global Search" icon={Search}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Tender #, name, client, WO, agreement…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button disabled={searchFetching || searchInput.trim().length < 2}>
              {searchFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>
          <div className="mt-4 max-h-72 overflow-y-auto">
            {searchTerm.length < 2 ? (
              <p className="text-sm text-muted-foreground">Enter at least 2 characters to search.</p>
            ) : searchFetching ? (
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            ) : searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((r) => (
                    <TableRow key={`${r.type}-${r.id}`}>
                      <TableCell className="capitalize">{r.type}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.tenderName}</div>
                        {r.tenderNumber && (
                          <div className="text-xs text-muted-foreground">{r.tenderNumber}</div>
                        )}
                      </TableCell>
                      <TableCell>{r.clientName || '—'}</TableCell>
                      <TableCell>
                        <Link
                          href={
                            r.type === 'contract'
                              ? `/tenders/${r.tenderId}/post-award`
                              : `/tenders/${r.tenderId}`
                          }
                          className="text-sm text-indigo-600 hover:underline"
                        >
                          Open
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Recent Activity */}
      <SectionCard title="Recent Activity" icon={Activity} className="col-span-full">
        {activityItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity recorded.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activityItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.user}</TableCell>
                  <TableCell>{item.action}</TableCell>
                  <TableCell>{item.module}</TableCell>
                  <TableCell>{formatDate(item.timestamp)}</TableCell>
                  <TableCell>
                    {item.tenderId && (
                      <Link
                        href={`/tenders/${item.tenderId}`}
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        View
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-muted-foreground dark:border-slate-700">
        <span className="flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" />
          Export architecture ready (Excel, PDF, CSV) — exports not enabled in Phase 1
        </span>
        <span>Generated {formatDate(dashboard.generatedAt)}</span>
      </div>
    </div>
  );
}
