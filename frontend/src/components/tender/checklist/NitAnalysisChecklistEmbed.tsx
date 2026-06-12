'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckSquare, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { ProfessionalNitChecklistView } from './ProfessionalNitChecklistView';
import { useChecklistWorkflowMutation } from './useChecklistWorkflowMutation';
import { getErrorMessage } from '@/lib/errorMessage';

interface Props {
  tenderId: string;
  token: string;
  userRole?: string;
  analysisRunning?: boolean;
  inline?: boolean;
}

export function NitAnalysisChecklistEmbed({
  tenderId,
  token,
  userRole,
  analysisRunning,
  inline = false,
}: Props) {
  const { handleWorkflow, workflowError, isSaving, pendingItemId } =
    useChecklistWorkflowMutation(tenderId, token);

  const {
    data: checklistResponse,
    isLoading,
    error,
    isFetching,
  } = useQuery({
    queryKey: ['tender-dynamic-checklist', tenderId],
    queryFn: () => api.getTenderDynamicChecklist(token, tenderId, false),
    enabled: !!token,
    retry: 1,
    staleTime: 30_000,
    refetchInterval: analysisRunning && !isSaving && !pendingItemId ? 10_000 : false,
  });

  const checklist = checklistResponse?.data;

  return (
    <section
      className={
        inline
          ? 'mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6'
          : 'mt-10 border-t border-slate-200 pt-8 print:break-before-page'
      }
    >
      <div className="mb-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 sm:text-xl">
          <CheckSquare className="h-5 w-5 text-blue-700" />
          Checklist &amp; Compliance Module
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Auto-generated below NIT analysis. Documents mentioned in the tender are marked{' '}
          <strong>Required</strong> — check each box once prepared.
        </p>
      </div>

      {isLoading && !checklist && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Generating compliance checklist from NIT requirements…
        </div>
      )}

      {error && !checklist && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          {getErrorMessage(error, 'Checklist will appear once NIT analysis completes.')}
        </div>
      )}

      {checklist && (
        <>
          {isFetching && !isSaving && (
            <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground no-print">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Updating checklist…
            </p>
          )}
          {workflowError && (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {workflowError}
            </p>
          )}
          <ProfessionalNitChecklistView
            data={checklist}
            userRole={userRole}
            onWorkflowAction={handleWorkflow}
            pendingItemId={pendingItemId}
          />
        </>
      )}
    </section>
  );
}
