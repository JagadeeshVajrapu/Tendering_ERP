'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { statusColor, formatCurrency } from '@/lib/utils';
import { Plus } from 'lucide-react';
import type { Tender } from '@/types';

export default function TendersPage() {
  const { token } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['tenders'],
    queryFn: () => api.getTenders(token!),
    enabled: !!token,
  });

  const tenders = data?.data || [];

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tenders</h1>
        <Link href="/tenders/new">
          <Button><Plus className="mr-2 h-4 w-4" /> New Tender</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tenders ({tenders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading...</p>
          ) : (
            <div className="space-y-3">
              {tenders.map((tender: Tender) => (
                <Link
                  key={tender._id}
                  href={`/tenders/${tender._id}`}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium">{tender.title}</p>
                    <p className="text-sm text-muted-foreground">{tender.tenderNumber || tender.authority}</p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColor(tender.status)}`}>
                      {tender.status.replace(/_/g, ' ')}
                    </span>
                    <p className="mt-1 text-sm font-medium">{formatCurrency(tender.estimatedValue)}</p>
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
