'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Bell,
  LogOut,
  IndianRupee,
  Building2,
  BarChart3,
  Users,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { APP_NAME, APP_TAGLINE } from '@/lib/branding';
import type { UserRole } from '@/types';
import { normalizeUserRole } from '@/lib/roles';

const navByRole: Record<UserRole, { href: string; label: string; icon: React.ElementType }[]> = {
  executive: [
    { href: '/dashboard/executive', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/tenders', label: 'My Tenders', icon: FileText },
    { href: '/awarded-contracts', label: 'Awarded Contracts', icon: Building2 },
    { href: '/dashboard/finance-approvals', label: 'My Finance Requests', icon: IndianRupee },
    { href: '/notifications', label: 'Notifications', icon: Bell },
  ],
  md: [
    { href: '/dashboard/md', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/awarded-contracts', label: 'Awarded Contracts', icon: Building2 },
    { href: '/management-reports', label: 'MIS & Management Reports', icon: BarChart3 },
    { href: '/notifications', label: 'Notifications', icon: Bell },
  ],
  finance: [
    { href: '/dashboard/finance', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/finance-approvals', label: 'Finance Approvals', icon: IndianRupee },
    { href: '/management-reports', label: 'MIS & Management Reports', icon: BarChart3 },
    { href: '/notifications', label: 'Notifications', icon: Bell },
  ],
  manager: [
    { href: '/dashboard/manager', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/awarded-contracts', label: 'Awarded Contracts', icon: Building2 },
    { href: '/management-reports', label: 'MIS & Management Reports', icon: BarChart3 },
    { href: '/dashboard/finance-approvals', label: 'Finance Approvals', icon: IndianRupee },
    { href: '/notifications', label: 'Notifications', icon: Bell },
  ],
  admin: [
    { href: '/dashboard/admin', label: 'Admin Dashboard', icon: Shield },
    { href: '/tenders', label: 'All Tenders', icon: FileText },
    { href: '/awarded-contracts', label: 'Awarded Contracts', icon: Building2 },
    { href: '/management-reports', label: 'MIS & Management Reports', icon: BarChart3 },
    { href: '/dashboard/admin/users', label: 'User Management', icon: Users },
    { href: '/notifications', label: 'Notifications', icon: Bell },
  ],
};

function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/dashboard/executive' || href === '/dashboard/admin') {
    return pathname === href;
  }
  return pathname.startsWith(href + '/');
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const role = user ? normalizeUserRole(user.role) : null;
  const items = role ? navByRole[role] : [];

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-white">
      <div className="border-b border-slate-800 px-6 py-5">
        <h1 className="text-lg font-bold tracking-tight">{APP_NAME}</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{APP_TAGLINE}</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/30'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-slate-400')} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-800 p-4">
        <div className="mb-3 rounded-lg bg-slate-900/60 px-3 py-2.5">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-slate-400">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
