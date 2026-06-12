'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { MisDashboardView } from '@/components/misReporting/MisDashboardView';
import { useAuthStore } from '@/stores/authStore';

const MIS_ROLES = new Set(['md', 'finance', 'manager', 'admin']);

export default function ManagementReportsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();

  useEffect(() => {
    if (user && !MIS_ROLES.has(user.role)) {
      router.replace('/dashboard/executive');
    }
  }, [user, router]);

  if (user && !MIS_ROLES.has(user.role)) {
    return null;
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Management Dashboard"
        description="MIS & Management Reports — executive visibility into tender performance, financial exposure, contract health, and revenue."
        icon={BarChart3}
        iconClassName="text-indigo-700"
      />

      {token && <MisDashboardView token={token} />}
    </DashboardLayout>
  );
}
