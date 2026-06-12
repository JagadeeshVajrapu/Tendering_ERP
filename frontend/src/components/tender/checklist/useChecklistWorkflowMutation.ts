'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessage';
import type {
  DynamicChecklistDisplayStatus,
  DynamicChecklistItemStatus,
  DynamicChecklistResult,
} from '@/types/dynamicChecklist';

function patchItemComplete(
  data: DynamicChecklistResult,
  itemId: string,
  markedComplete: boolean
): DynamicChecklistResult {
  const categories = data.categories.map((cat) => ({
    ...cat,
    items: cat.items.map((item) => {
      if (item.id !== itemId) return item;
      const status: DynamicChecklistItemStatus = markedComplete
        ? 'uploaded'
        : item.required
          ? 'missing'
          : 'optional';
      const displayStatus: DynamicChecklistDisplayStatus = markedComplete
        ? 'uploaded'
        : item.required
          ? 'required'
          : 'optional';
      return {
        ...item,
        markedComplete,
        uploaded: markedComplete,
        missing: item.required && !markedComplete,
        status,
        displayStatus,
      };
    }),
  }));

  return { ...data, categories };
}

export function useChecklistWorkflowMutation(tenderId: string, token: string) {
  const queryClient = useQueryClient();
  const [workflowError, setWorkflowError] = useState('');
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const workflowMutation = useMutation({
    mutationFn: ({ itemId, action, note }: { itemId: string; action: string; note?: string }) =>
      api.updateChecklistItem(token, tenderId, itemId, { action, note }),
    onMutate: async ({ itemId, action }) => {
      setWorkflowError('');
      setPendingItemId(itemId);
      await queryClient.cancelQueries({ queryKey: ['tender-dynamic-checklist', tenderId] });
      const previous = queryClient.getQueryData<{ data: DynamicChecklistResult }>([
        'tender-dynamic-checklist',
        tenderId,
      ]);
      if (previous?.data) {
        const markedComplete = action === 'mark_complete';
        queryClient.setQueryData(['tender-dynamic-checklist', tenderId], {
          data: patchItemComplete(previous.data, itemId, markedComplete),
        });
      }
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tender-dynamic-checklist', tenderId], context.previous);
      }
      setWorkflowError(getErrorMessage(err, 'Could not update checklist item'));
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['tender-dynamic-checklist', tenderId], data);
      void queryClient.invalidateQueries({ queryKey: ['submission-tracking', tenderId] });
    },
    onSettled: () => {
      setPendingItemId(null);
    },
  });

  const handleWorkflow = useCallback(
    (itemId: string, checked: boolean) => {
      workflowMutation.mutate({
        itemId,
        action: checked ? 'mark_complete' : 'unmark_complete',
      });
    },
    [workflowMutation]
  );

  return {
    handleWorkflow,
    workflowError,
    isSaving: workflowMutation.isPending,
    pendingItemId,
  };
}
