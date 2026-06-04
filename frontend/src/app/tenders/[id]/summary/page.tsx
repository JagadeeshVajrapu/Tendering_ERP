'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SummaryReport } from '@/components/tender/SummaryReport';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Printer } from 'lucide-react';

export default function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['summary', id],
    queryFn: () => api.getSummary(token!, id),
    enabled: !!token,
  });

  const summary = data?.data?.summary;

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between no-print">
        <h1 className="text-2xl font-bold">Summary Report</h1>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print / PDF
        </Button>
      </div>
      {isLoading && <p>Loading summary...</p>}
      {summary && <SummaryReport summary={summary} />}
      {!isLoading && !summary && (
        <p className="text-center text-muted-foreground py-12">No summary generated yet. Run analysis and generate summary first.</p>
      )}
    </DashboardLayout>
  );
}
