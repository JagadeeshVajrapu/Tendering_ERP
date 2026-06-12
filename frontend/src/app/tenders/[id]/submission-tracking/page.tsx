'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SubmissionTrackingView } from '@/components/submissionTracking/SubmissionTrackingView';
import { useAuthStore } from '@/stores/authStore';

export default function SubmissionTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, user } = useAuthStore();
  const canEdit = user?.role === 'executive' || user?.role === 'manager';

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link
          href={`/tenders/${id}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tender
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <ClipboardCheck className="h-7 w-7 text-blue-700" />
          Submission Tracking
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Verify readiness, lock the submission package, upload portal proof, and track deadlines before and after
          bid submission.
        </p>
      </div>

      {token && <SubmissionTrackingView token={token} tenderId={id} canEdit={canEdit} />}
    </DashboardLayout>
  );
}
