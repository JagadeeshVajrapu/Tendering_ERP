'use client';

import { use } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SubmissionTrackingView } from '@/components/submissionTracking/SubmissionTrackingView';
import { TenderPageHeader } from '@/components/tender/TenderPageHeader';
import { useTenderNavContext } from '@/components/tender/useTenderNavContext';
import { useAuthStore } from '@/stores/authStore';

export default function SubmissionTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, user } = useAuthStore();
  const { tender, analysisComplete, hasReport, submissionStatus } = useTenderNavContext(id);
  const canEdit = user?.role === 'executive' || user?.role === 'manager';

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
        pageTitle="Submission Tracking"
        pageDescription="Verify readiness, lock the submission package, upload portal proof, and track deadlines."
      />

      {token && <SubmissionTrackingView token={token} tenderId={id} canEdit={canEdit} />}
    </DashboardLayout>
  );
}
