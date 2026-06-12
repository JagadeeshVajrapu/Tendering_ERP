'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/stores/authStore';
import { NotificationBell } from '@/components/NotificationBell';
import {
  canAccessPath,
  getRoleDashboardPath,
  getRoleLabel,
  normalizeUserRole,
} from '@/lib/roles';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, updateUser, logout } = useAuthStore();
  const [profileChecked, setProfileChecked] = useState(false);

  // Sync user profile from server (fixes stale role after switching accounts)
  useEffect(() => {
    if (!token) {
      setProfileChecked(true);
      return;
    }

    let cancelled = false;
    setProfileChecked(false);

    api
      .getProfile(token)
      .then((res) => {
        if (cancelled) return;
        const profile = res.data;
        const role = normalizeUserRole(profile.role);
        if (!role) {
          logout();
          router.replace('/login');
          return;
        }
        updateUser({ ...profile, role });
      })
      .catch(() => {
        if (!cancelled) {
          logout();
          router.replace('/login');
        }
      })
      .finally(() => {
        if (!cancelled) setProfileChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token, updateUser, logout, router]);

  // Auth + role-based route guard
  useEffect(() => {
    if (!profileChecked) return;

    if (!token || !user) {
      router.replace('/login');
      return;
    }

    if (!canAccessPath(pathname, user.role)) {
      router.replace(getRoleDashboardPath(user.role));
    }
  }, [token, user, pathname, router, profileChecked]);

  if (!token || !user || !profileChecked) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    );
  }

  if (!canAccessPath(pathname, user.role)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-muted-foreground">Redirecting to your dashboard…</p>
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
