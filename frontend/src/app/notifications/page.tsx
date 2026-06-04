'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/lib/utils';

export default function NotificationsPage() {
  const { token } = useAuthStore();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications(token!),
    enabled: !!token,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.data || [];

  return (
    <DashboardLayout>
      <h1 className="mb-8 text-3xl font-bold">Notifications</h1>
      <Card>
        <CardHeader>
          <CardTitle>All Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.map((n) => (
            <button
              key={n._id}
              onClick={() => !n.isRead && markRead.mutate(n._id)}
              className={`w-full rounded-lg border p-4 text-left ${!n.isRead ? 'border-blue-200 bg-blue-50' : ''}`}
            >
              <div className="flex justify-between">
                <p className="font-medium">{n.title}</p>
                <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
            </button>
          ))}
          {notifications.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">No notifications</p>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
