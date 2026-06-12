'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { AdminDashboardView } from '@/components/admin/AdminDashboardView';
import { useAuthStore } from '@/stores/authStore';
import { getRoleDashboardPath } from '@/lib/roles';

export default function AdminDashboardPage() {
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
      <PageHeader
        title="Admin Dashboard"
        description="Executive-level control center for business owners, directors, and senior management."
        icon={Shield}
        iconClassName="text-violet-700"
      />
      {token && <AdminDashboardView token={token} />}
    </DashboardLayout>
  );
}
