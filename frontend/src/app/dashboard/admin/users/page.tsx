'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AdminUsersView } from '@/components/admin/AdminUsersView';
import { useAuthStore } from '@/stores/authStore';
import { getRoleDashboardPath } from '@/lib/roles';

export default function AdminUsersPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.replace(getRoleDashboardPath(user.role));
    }
  }, [user, router]);

  if (user && user.role !== 'admin') return null;

  return (
    <DashboardLayout>
      <Link
        href="/dashboard/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-violet-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Admin Dashboard
      </Link>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <Users className="h-7 w-7 text-violet-700" />
          User Management
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage user roles and account status across the organization.
        </p>
      </div>
      {token && <AdminUsersView token={token} />}
    </DashboardLayout>
  );
}
