import type { UserRole } from '@/types';

const VALID_ROLES: UserRole[] = ['executive', 'md', 'finance', 'manager', 'admin'];

export function normalizeUserRole(role: string | undefined | null): UserRole | null {
  if (!role) return null;
  const normalized = role.toLowerCase().trim() as UserRole;
  return VALID_ROLES.includes(normalized) ? normalized : null;
}

export function getRoleDashboardPath(role: UserRole | string): string {
  const normalized = normalizeUserRole(typeof role === 'string' ? role : role);
  if (!normalized) return '/login';

  const paths: Record<UserRole, string> = {
    executive: '/dashboard/executive',
    md: '/dashboard/md',
    finance: '/dashboard/finance',
    manager: '/dashboard/manager',
    admin: '/dashboard/admin',
  };
  return paths[normalized];
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

/** Routes restricted to executive (and admin) only */
export const EXECUTIVE_ONLY_PREFIXES = ['/tenders/new'];

export function isExecutiveOnlyPath(pathname: string): boolean {
  return EXECUTIVE_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
}

export function canAccessTenderList(role: UserRole): boolean {
  return role === 'executive' || role === 'admin';
}

interface RouteRule {
  prefix: string;
  roles: UserRole[];
}

/** Most specific prefixes first */
const ROUTE_RULES: RouteRule[] = [
  { prefix: '/dashboard/admin/users', roles: ['admin'] },
  { prefix: '/dashboard/admin', roles: ['admin'] },
  { prefix: '/dashboard/executive', roles: ['executive'] },
  { prefix: '/dashboard/manager', roles: ['manager'] },
  { prefix: '/dashboard/md', roles: ['md'] },
  { prefix: '/dashboard/finance-approvals', roles: ['executive', 'finance', 'manager', 'admin'] },
  { prefix: '/dashboard/finance', roles: ['finance'] },
  { prefix: '/management-reports', roles: ['md', 'finance', 'manager', 'admin'] },
  { prefix: '/tenders/new', roles: ['executive', 'admin'] },
  { prefix: '/awarded-contracts', roles: ['executive', 'md', 'manager', 'admin'] },
  { prefix: '/notifications', roles: ['executive', 'md', 'finance', 'manager', 'admin'] },
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Whether the signed-in role may view this path.
 */
export function canAccessPath(pathname: string, role: UserRole): boolean {
  if (pathname === '/login') return true;

  // MD may open feasibility report on a tender
  if (matchesPrefix(pathname, '/tenders') && pathname.includes('/report') && role === 'md') {
    return true;
  }

  // Tender workspace: executive + admin
  if (matchesPrefix(pathname, '/tenders')) {
    return role === 'executive' || role === 'admin';
  }

  for (const rule of ROUTE_RULES) {
    if (matchesPrefix(pathname, rule.prefix)) {
      return rule.roles.includes(role);
    }
  }

  return true;
}

/** Dashboard path segment required for a URL, if any */
export function getDashboardRoleForPath(pathname: string): UserRole | null {
  if (matchesPrefix(pathname, '/dashboard/executive')) return 'executive';
  if (matchesPrefix(pathname, '/dashboard/manager')) return 'manager';
  if (matchesPrefix(pathname, '/dashboard/md')) return 'md';
  if (matchesPrefix(pathname, '/dashboard/finance') && !pathname.includes('finance-approvals')) {
    return 'finance';
  }
  if (matchesPrefix(pathname, '/dashboard/admin')) return 'admin';
  return null;
}
