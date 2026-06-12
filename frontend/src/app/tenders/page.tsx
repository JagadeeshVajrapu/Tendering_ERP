'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorState, ListSkeleton } from '@/components/shared/QueryState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/lib/utils';
import { getTenderDisplayLabel, statusColor } from '@/lib/tenderStatus';
import { FileText, Plus, Search } from 'lucide-react';
import type { Tender } from '@/types';

export default function TendersPage() {
  const { token, user } = useAuthStore();
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['tenders'],
    queryFn: () => api.getTenders(token!),
    enabled: !!token,
  });

  const tenders = data?.data || [];
  const isAdmin = user?.role === 'admin';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenders;
    return tenders.filter(
      (t: Tender) =>
        t.title.toLowerCase().includes(q) ||
        t.tenderNumber?.toLowerCase().includes(q) ||
        t.authority?.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q)
    );
  }, [tenders, search]);

  return (
    <DashboardLayout>
      <PageHeader
        title={isAdmin ? 'All Tenders' : 'My Tenders'}
        description={
          isAdmin
            ? 'Organization-wide tender pipeline and status overview.'
            : 'Track and manage your assigned tender opportunities.'
        }
        icon={FileText}
        actions={
          user?.role === 'executive' ? (
            <Link href="/tenders/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Tender
              </Button>
            </Link>
          ) : undefined
        }
      />

      <Card className="border-slate-100 shadow-sm">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            {isLoading ? 'Loading tenders…' : `${filtered.length} tender${filtered.length === 1 ? '' : 's'}`}
          </CardTitle>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search title, number, client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : isLoading ? (
            <ListSkeleton rows={6} />
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {search ? 'No tenders match your search.' : 'No tenders found.'}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((tender: Tender) => (
                <Link
                  key={tender._id}
                  href={`/tenders/${tender._id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-4 transition-all hover:border-blue-100 hover:bg-blue-50/30 hover:shadow-sm"
                >
                  <div className="min-w-0 pr-4">
                    <p className="truncate font-medium text-slate-900">{tender.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {tender.tenderNumber || tender.authority || '—'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${statusColor(tender.status)}`}
                    >
                      {getTenderDisplayLabel(tender.status, tender.currentStage)}
                    </span>
                    <p className="mt-1 text-sm font-semibold">{formatCurrency(tender.estimatedValue)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
