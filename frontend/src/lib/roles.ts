import type { UserRole } from '@/types';

export function getRoleDashboardPath(role: UserRole): string {
  const paths: Record<UserRole, string> = {
    executive: '/dashboard/executive',
    md: '/dashboard/md',
    finance: '/dashboard/finance',
    manager: '/dashboard/manager',
    admin: '/dashboard/admin',
  };
  return paths[role];
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    executive: 'Executive',
    md: 'Managing Director',
    finance: 'Finance',
    manager: 'Compliance Manager',
    admin: 'Administrator',
  };
  return labels[role];
}

/** Routes restricted to executive only */
export const EXECUTIVE_ONLY_PREFIXES = ['/tenders/new'];

export function isExecutiveOnlyPath(pathname: string): boolean {
  return EXECUTIVE_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
}

export function canAccessTenderList(role: UserRole): boolean {
  return role === 'executive' || role === 'admin';
}
