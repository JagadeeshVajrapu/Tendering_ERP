'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FinanceApprovalDashboard } from '@/components/financeWorkflow/FinanceApprovalDashboard';
import { useAuthStore } from '@/stores/authStore';
import { ClipboardList } from 'lucide-react';

export default function FinanceApprovalsPage() {
  const { token, user } = useAuthStore();
  const canApprove = user?.role === 'finance' || user?.role === 'manager';

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <ClipboardList className="h-7 w-7 text-emerald-700" />
          Finance Approval Dashboard
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Manage pending approvals, refund requests, BG/PBG renewals, finance tasks, notifications, and audit
          trail across all tenders.
        </p>
      </div>

      {token && <FinanceApprovalDashboard token={token} canApprove={canApprove} />}
    </DashboardLayout>
  );
}
