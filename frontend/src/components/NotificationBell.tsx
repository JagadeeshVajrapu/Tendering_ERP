'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export function NotificationBell() {
  const { token } = useAuthStore();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications(token!),
    enabled: !!token,
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.data || [];
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="relative group">
      <button className="relative rounded-lg p-2 hover:bg-slate-100">
        <Bell className="h-5 w-5 text-slate-600" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unread}
          </span>
        )}
      </button>
      <div className="absolute right-0 top-full z-50 hidden w-80 rounded-xl border bg-white shadow-lg group-hover:block">
        <div className="border-b p-3 font-semibold">Notifications</div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No notifications</p>
          ) : (
            notifications.slice(0, 10).map((n) => (
              <button
                key={n._id}
                onClick={() => !n.isRead && markRead.mutate(n._id)}
                className={`w-full border-b p-3 text-left text-sm hover:bg-slate-50 ${!n.isRead ? 'bg-blue-50' : ''}`}
              >
                <p className="font-medium">{n.title}</p>
                <p className="text-slate-500">{n.message}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
