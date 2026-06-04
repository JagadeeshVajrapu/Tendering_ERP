'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/stores/authStore';
import { NotificationBell } from '@/components/NotificationBell';
import { getRoleDashboardPath, isExecutiveOnlyPath, canAccessTenderList } from '@/lib/roles';
import { getRoleLabel } from '@/lib/roles';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user } = useAuthStore();

  useEffect(() => {
    if (!token) {
      router.replace('/login');
      return;
    }
    if (!user) return;

    if (isExecutiveOnlyPath(pathname) && user.role !== 'executive') {
      router.replace(getRoleDashboardPath(user.role));
      return;
    }

    if (pathname.startsWith('/tenders') && !canAccessTenderList(user.role) && !pathname.includes('/report')) {
      router.replace(getRoleDashboardPath(user.role));
    }
  }, [token, user, pathname, router]);

  if (!token || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-white px-8">
          <p className="text-sm text-muted-foreground">
            {getRoleLabel(user.role)} Portal
          </p>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
