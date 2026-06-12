'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/QueryState';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/lib/utils';
import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  const { token } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications(token!),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.data || [];
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <DashboardLayout>
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'You are all caught up'}
        icon={Bell}
      />

      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-4 pt-6">
          {isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : isLoading ? (
            <ListSkeleton rows={5} />
          ) : notifications.length === 0 ? (
            <EmptyState title="No notifications" description="Alerts about tenders, approvals, and deadlines will appear here." />
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => !n.isRead && markRead.mutate(n._id)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    !n.isRead
                      ? 'border-blue-200 bg-blue-50/80 hover:bg-blue-50'
                      : 'border-slate-100 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{n.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
                  </div>
                  {!n.isRead && (
                    <span className="mt-2 inline-block rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      New
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
