'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Bell,
  LogOut,
  IndianRupee,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { APP_NAME, APP_TAGLINE } from '@/lib/branding';
import type { UserRole } from '@/types';

const navByRole: Record<UserRole, { href: string; label: string; icon: React.ElementType }[]> = {
  executive: [
    { href: '/dashboard/executive', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/tenders', label: 'My Tenders', icon: FileText },
    { href: '/notifications', label: 'Notifications', icon: Bell },
  ],
  md: [
    { href: '/dashboard/md', label: 'Feasibility Reviews', icon: LayoutDashboard },
    { href: '/notifications', label: 'Notifications', icon: Bell },
  ],
  finance: [
    { href: '/dashboard/finance', label: 'Finance Desk', icon: LayoutDashboard },
    { href: '/notifications', label: 'Notifications', icon: Bell },
  ],
  manager: [
    { href: '/dashboard/manager', label: 'Compliance Desk', icon: LayoutDashboard },
    { href: '/notifications', label: 'Notifications', icon: Bell },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const items = user ? navByRole[user.role] : [];

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-slate-950 text-white">
      <div className="border-b border-slate-800 p-6">
        <h1 className="text-lg font-bold tracking-tight">{APP_NAME}</h1>
        <p className="mt-1 text-xs text-slate-400">{APP_TAGLINE}</p>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== '/dashboard/executive' && pathname.startsWith(item.href + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-800 p-4">
        <div className="mb-3 px-3">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-slate-400">{user?.email}</p>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
