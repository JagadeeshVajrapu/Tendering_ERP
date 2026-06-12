'use client';

import { EnterpriseDynamicChecklistView } from '@/components/tender/checklist/EnterpriseDynamicChecklistView';
import { DynamicChecklistResult } from '@/types/dynamicChecklist';

export function DynamicChecklistPanel({ data }: { data: DynamicChecklistResult }) {
  return <EnterpriseDynamicChecklistView data={data} tenderId={data.tenderId} />;
}
