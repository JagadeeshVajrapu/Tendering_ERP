'use client';

import { use } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PostAwardView } from '@/components/postAward/PostAwardView';
import { TenderPageHeader } from '@/components/tender/TenderPageHeader';
import { useTenderNavContext } from '@/components/tender/useTenderNavContext';
import { useAuthStore } from '@/stores/authStore';

export default function PostAwardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, user } = useAuthStore();
  const { tender, analysisComplete, hasReport, submissionStatus } = useTenderNavContext(id);
  const canWrite = user?.role === 'executive' || user?.role === 'md';
  const canApprove = user?.role === 'manager' || user?.role === 'md';
  const canAward = user?.role === 'executive' || user?.role === 'md';

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
        pageTitle="Post-Award Follow-Up"
        pageDescription="Manage contracts, revenue, billing, and renewals after tender award."
      />

      {token && (
        <PostAwardView
          token={token}
          tenderId={id}
          canWrite={canWrite}
          canApprove={canApprove}
          canAward={canAward}
        />
      )}
    </DashboardLayout>
  );
}
