'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  IndianRupee,
  Loader2,
  RefreshCw,
  Search,
  TrendingUp,
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
import { formatCurrency, formatDate } from '@/lib/utils';
import { ErrorState, LoadingState } from '@/components/shared/QueryState';
import type { PostAwardDashboard } from '@/types/postAward';

function priorityBadge(p: string) {
  const map: Record<string, string> = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-900',
    medium: 'bg-amber-100 text-amber-900',
    low: 'bg-slate-100 text-slate-700',
  };
  return map[p] || map.low;
}

interface Props {
  token: string;
}

export function AwardedContractsDashboard({ token }: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['post-award-dashboard', search, page],
    queryFn: () =>
      api.getPostAwardDashboard(token, {
        q: search || undefined,
        page,
        limit: 20,
        sortBy: 'awardedAt',
        sortOrder: 'desc',
      }),
    enabled: !!token,
    staleTime: 0,
  });

  const dashboard: PostAwardDashboard | null = data?.data ?? null;

  if (isLoading) {
    return <LoadingState message="Loading awarded contracts…" />;
  }

  if (isError || !dashboard) {
    return <ErrorState error={error} onRetry={() => refetch()} title="Unable to load awarded contracts" />;
  }

  const s = dashboard.summary;
  const cards = [
    { label: 'Total Awarded', value: s.totalAwardedContracts, icon: Building2 },
    { label: 'Active Contracts', value: s.activeContracts, icon: TrendingUp },
    { label: 'Expiring Soon', value: s.contractsExpiringSoon, icon: AlertTriangle },
    { label: 'AMC Expiring', value: s.amcExpiringSoon, icon: AlertTriangle },
    { label: 'Total Revenue', value: formatCurrency(s.totalRevenue), icon: IndianRupee },
    { label: 'Revenue Received', value: formatCurrency(s.revenueReceived), icon: IndianRupee },
    { label: 'Revenue Pending', value: formatCurrency(s.revenuePending), icon: IndianRupee },
    { label: 'Pending Billing', value: formatCurrency(s.pendingBilling), icon: IndianRupee },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search client, tender #, WO, agreement, PO…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Icon className="h-4 w-4" />
                {card.label}
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{card.value}</p>
            </div>
          );
        })}
      </div>

      {dashboard.alerts.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-amber-950 dark:text-amber-100">
            <AlertTriangle className="h-5 w-5" />
            Active Alerts
          </h2>
          <ul className="space-y-2">
            {dashboard.alerts.slice(0, 8).map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm dark:bg-slate-900"
              >
                <span>{a.message}</span>
                <Badge className={priorityBadge(a.priority)}>{a.priority}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-semibold">Awarded Contracts</h2>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Tender</TableHead>
                <TableHead>WO / Agreement</TableHead>
                <TableHead>Contract Value</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Awarded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.contracts.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No awarded contracts yet. Mark a submitted tender as Awarded to activate post-award tracking.
                  </TableCell>
                </TableRow>
              ) : (
                dashboard.contracts.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.clientName}</TableCell>
                    <TableCell>
                      <Link
                        href={`/tenders/${c.tenderId}/post-award`}
                        className="text-blue-700 hover:underline dark:text-blue-400"
                      >
                        {c.tenderTitle}
                      </Link>
                      {c.tenderNumber && (
                        <p className="text-xs text-muted-foreground">{c.tenderNumber}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.workOrderNumber && <p>WO: {c.workOrderNumber}</p>}
                      {c.agreementNumber && <p>AGR: {c.agreementNumber}</p>}
                    </TableCell>
                    <TableCell>{formatCurrency(c.contractValue)}</TableCell>
                    <TableCell>
                      <p>{formatCurrency(c.revenueReceived)}</p>
                      <p className="text-xs text-amber-700">Pending {formatCurrency(c.revenuePending)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(c.awardedAt || c.activatedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {dashboard.contracts.totalPages > 1 && (
          <div className="mt-4 flex justify-between text-sm">
            <span className="text-muted-foreground">
              Page {dashboard.contracts.page} of {dashboard.contracts.totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= dashboard.contracts.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>

      {dashboard.recentActivity.length > 0 && (
        <section className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900">
          <h2 className="mb-3 text-lg font-semibold">Recent Activity</h2>
          <ul className="space-y-2">
            {dashboard.recentActivity.slice(0, 10).map((entry) => (
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
