'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/stores/authStore';
import { NotificationBell } from '@/components/NotificationBell';
import { getRoleDashboardPath, isExecutiveOnlyPath, canAccessTenderList, getRoleLabel } from '@/lib/roles';
import { Loader2 } from 'lucide-react';

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
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-6 backdrop-blur-sm lg:px-8">
          <div>
            <p className="text-sm font-medium text-slate-800">{getRoleLabel(user.role)} Portal</p>
            <p className="text-xs text-muted-foreground">Welcome back, {user.name}</p>
          </div>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto scroll-smooth p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
