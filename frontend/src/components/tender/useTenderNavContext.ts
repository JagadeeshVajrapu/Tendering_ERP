'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '@/lib/api';
import { resolveEffectiveTenderStatus } from '@/lib/tenderStatus';
import { useAuthStore } from '@/stores/authStore';
import type { SubmissionTrackingStatus } from '@/types/submissionTracking';

export function useTenderNavContext(tenderId: string) {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: tenderData, isLoading: tenderLoading } = useQuery({
    queryKey: ['tender', tenderId],
    queryFn: () => api.getTender(token!, tenderId),
    enabled: !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: analysisData, isLoading: analysisLoading } = useQuery({
    queryKey: ['analysis', tenderId],
    queryFn: () => api.getTenderAnalysis(token!, tenderId),
    enabled: !!token,
    retry: false,
    staleTime: 15_000,
  });

  const { data: submissionData } = useQuery({
    queryKey: ['submission-tracking', tenderId],
    queryFn: () => api.getSubmissionTrackingDashboard(token!, tenderId),
    enabled: !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const tender = tenderData?.data;
  const submissionStatus = submissionData?.data?.submissionStatus as SubmissionTrackingStatus | undefined;
  const analysisComplete = analysisData?.data?.job?.status === 'completed';
  const hasReport = !!analysisData?.data?.report;

  const effectiveStatus = resolveEffectiveTenderStatus(tender?.status, { submissionStatus });
  const effectiveStage =
    effectiveStatus === 'SUBMITTED'
      ? 'Submitted'
      : effectiveStatus === 'AWARDED'
        ? 'Awarded'
        : tender?.currentStage;

  const refreshTender = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['tender', tenderId] });
    void queryClient.invalidateQueries({ queryKey: ['submission-tracking', tenderId] });
  }, [queryClient, tenderId]);

  return {
    tender,
    analysisComplete,
    hasReport,
    submissionStatus,
    effectiveStatus,
    effectiveStage,
    isLoading: tenderLoading || analysisLoading,
    refreshTender,
  };
}
