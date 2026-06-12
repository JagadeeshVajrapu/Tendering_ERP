'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FinanceApprovalDashboard } from '@/components/financeWorkflow/FinanceApprovalDashboard';
import { useAuthStore } from '@/stores/authStore';
import { ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

export default function FinanceApprovalsPage() {
  const { token, user } = useAuthStore();
  const canApprove = user?.role === 'finance' || user?.role === 'manager';

  return (
    <DashboardLayout>
      <PageHeader
        title="Finance Approval Dashboard"
        description="Manage approvals, refunds, BG/PBG renewals, tasks, and audit trail across all tenders."
        icon={ClipboardList}
        iconClassName="text-emerald-700"
      />

      {token && <FinanceApprovalDashboard token={token} canApprove={canApprove} />}
    </DashboardLayout>
  );
}
