'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AwardedContractsDashboard } from '@/components/postAward/AwardedContractsDashboard';
import { useAuthStore } from '@/stores/authStore';
import { Building2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

export default function AwardedContractsPage() {
  const { token } = useAuthStore();

  return (
    <DashboardLayout>
      <PageHeader
        title="Awarded Contracts"
        description="Centralized contract lifecycle — search clients, monitor expiries, track revenue and billing."
        icon={Building2}
        iconClassName="text-emerald-700"
      />

      {token && <AwardedContractsDashboard token={token} />}
    </DashboardLayout>
  );
}
