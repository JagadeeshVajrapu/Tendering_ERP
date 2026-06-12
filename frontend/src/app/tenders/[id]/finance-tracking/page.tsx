'use client';

import { use } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FinanceTrackingView } from '@/components/financeTracking/FinanceTrackingView';
import { TenderPageHeader } from '@/components/tender/TenderPageHeader';
import { useTenderNavContext } from '@/components/tender/useTenderNavContext';
import { useAuthStore } from '@/stores/authStore';

export default function FinanceTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, user } = useAuthStore();
  const { tender, analysisComplete, hasReport, submissionStatus } = useTenderNavContext(id);
  const canEdit =
    user?.role === 'executive' || user?.role === 'manager' || user?.role === 'finance';

  return (
    <DashboardLayout>
      <TenderPageHeader
        tenderId={id}
        title={tender?.title}
        status={tender?.status}
        currentStage={tender?.currentStage}
        submissionStatus={submissionStatus}
        userRole={user?.role}
        analysisComplete={analysisComplete}
        hasReport={hasReport}
        showBack
        pageTitle="Finance Tracking"
        pageDescription="Track EMD, guarantees, fees, refunds, expiry alerts, and financial documents."
      />

      {token && <FinanceTrackingView token={token} tenderId={id} canEdit={canEdit} />}
    </DashboardLayout>
  );
}
